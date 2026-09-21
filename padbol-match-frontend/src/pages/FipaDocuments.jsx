import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import {
  FIPA_INTEREST_PURPOSES,
  FIPA_NOT_FOUND_VENUE_VALUE,
  buildFipaAccessRequestPayload,
  downloadFipaDocument,
  fetchFipaAccountEligibility,
  fetchFipaDocuments,
  fetchFipaLibraryState,
  fetchOfficialFipaVenues,
  mergeFipaDocumentCatalog,
  normalizeFipaLibraryState,
  normalizeFipaDocumentSlug,
  submitFipaAccessRequest,
  submitFipaInterestProfile,
  validateFipaAccessRequestForm,
} from '../utils/fipaDocumentsApi';
import { assessAgeEligibility } from '../utils/ageEligibility';
import { registerCurrentAccountEligibility } from '../utils/legalDocuments';
import { padbolBrandLogoSrc } from '../constants/padbolBrandLogo';
import './FipaDocuments.css';

const EMPTY_FORM = Object.freeze({
  purpose: '',
  purposeOther: '',
  playsPadbol: '',
  clubLink: '',
  venueId: '',
  country: '',
  city: '',
  venueName: '',
  location: '',
  purposeAcknowledged: false,
  whatsappOptIn: false,
  whatsapp: '',
});

const PURPOSE_KEYS = Object.freeze({
  aprender_jugar: 'learn',
  jugador: 'player',
  entrenador_arbitro: 'coachReferee',
  club_sede: 'clubVenue',
  organizar_competencia: 'organize',
  investigacion_prensa: 'researchPress',
  evaluar_proyecto: 'evaluateProject',
  otro: 'other',
});

const ANSWER_KEYS = Object.freeze({ yes: 'yes', no: 'no', prefer_not: 'preferNot' });

function formatVenue(venue) {
  return [venue.nombre, venue.ciudad, venue.pais].filter(Boolean).join(' · ');
}

function normalizeSavedProfile(profile) {
  if (Array.isArray(profile)) return profile[0] || null;
  return profile && typeof profile === 'object' ? profile : null;
}

function formFromProfile(profile) {
  const saved = normalizeSavedProfile(profile) || {};
  return {
    ...EMPTY_FORM,
    purpose: saved.purpose || '',
    purposeOther: saved.purpose_other || '',
    playsPadbol: saved.plays_padbol || '',
    clubLink: saved.linked_to_club || '',
    venueId: saved.venue_not_listed
      ? FIPA_NOT_FOUND_VENUE_VALUE
      : String(saved.declared_sede_id || saved.sede_id || ''),
    country: saved.country || '',
    city: saved.city || '',
    venueName: saved.club_name || '',
    location: saved.address || '',
    purposeAcknowledged: true,
  };
}

function memberRequestBodyFromProfile(profile) {
  const saved = normalizeSavedProfile(profile) || {};
  return {
    sede_id: saved.declared_sede_id || saved.sede_id || null,
    cancha_no_encontrada: saved.venue_not_listed === true || saved.cancha_no_encontrada === true,
    nombre_cancha: saved.club_name || null,
    pais: saved.country || null,
    ciudad: saved.city || null,
    direccion_ubicacion: saved.address || null,
  };
}

function profileHasVenue(profile) {
  const saved = normalizeSavedProfile(profile) || {};
  if (saved.linked_to_club !== 'yes') return false;
  if (saved.declared_sede_id || saved.sede_id) return true;
  return Boolean(
    (saved.venue_not_listed || saved.cancha_no_encontrada)
      && saved.club_name
      && saved.country
      && saved.city
      && saved.address,
  );
}

function canAccessFipaDocument(documentItem, libraryState) {
  if (documentItem?.published === false) return false;
  if (!libraryState?.interestCompleted) return false;
  return documentItem?.accessLevel === 'authenticated' || libraryState?.grantActive === true;
}

function friendlyApiError(error, t, fallbackKey) {
  if (error?.status === 401) return t('fipaLibrary.errors.session', 'Tu sesión venció. Vuelve a ingresar.');
  if (error?.code === 'interest_profile_required') {
    return t('fipaLibrary.errors.interestRequired', 'Completa tu ficha de interés antes de la primera descarga.');
  }
  if (error?.status === 403) return t('fipaLibrary.errors.forbidden', 'Este documento requiere una membresía aprobada.');
  if (error?.status === 409) return t('fipaLibrary.errors.pending', 'Ya tienes una solicitud en revisión.');
  if (error?.status === 429) return t('fipaLibrary.errors.rateLimit', 'Espera unos minutos antes de volver a intentar.');
  return t(fallbackKey, 'No pudimos completar la operación. Intenta nuevamente.');
}

export default function FipaDocuments() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();
  const accessToken = session?.access_token || '';
  const [documents, setDocuments] = useState(() => mergeFipaDocumentCatalog([]));
  const [libraryState, setLibraryState] = useState(() => normalizeFipaLibraryState({}));
  const [officialVenues, setOfficialVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM }));
  const [editingInterest, setEditingInterest] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');
  const [submittingMember, setSubmittingMember] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [eligibilityStatus, setEligibilityStatus] = useState('loading');
  const [eligibilityNonce, setEligibilityNonce] = useState(0);
  const [birthDate, setBirthDate] = useState('');
  const [ageError, setAgeError] = useState('');
  const [ageSaving, setAgeSaving] = useState(false);
  const requestedDocument = normalizeFipaDocumentSlug(searchParams.get('document'));

  useEffect(() => {
    if (!accessToken) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setEligibilityStatus('loading');
    setServiceUnavailable(false);
    void (async () => {
      try {
        const eligibility = await fetchFipaAccountEligibility({ accessToken, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!eligibility.allowed) {
          setEligibilityStatus('required');
          setLoading(false);
          return;
        }
        setEligibilityStatus('allowed');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error?.code === 'age_verification_required') setEligibilityStatus('required');
        else if (error?.code === 'account_not_eligible') setEligibilityStatus('blocked');
        else setEligibilityStatus('error');
        setLoading(false);
        return;
      }

      const [stateResult, documentsResult, venuesResult] = await Promise.allSettled([
        fetchFipaLibraryState({ accessToken, signal: controller.signal }),
        fetchFipaDocuments({ accessToken, signal: controller.signal }),
        fetchOfficialFipaVenues({ accessToken, signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (stateResult.status === 'fulfilled') setLibraryState(stateResult.value);
      if (documentsResult.status === 'fulfilled') setDocuments(documentsResult.value);
      if (venuesResult.status === 'fulfilled') setOfficialVenues(venuesResult.value);
      setServiceUnavailable(stateResult.status === 'rejected' || documentsResult.status === 'rejected');
      setLoading(false);
    })();
    return () => controller.abort();
  }, [accessToken, eligibilityNonce]);

  useEffect(() => {
    if (loading || !requestedDocument) return undefined;
    if (!documents.some((item) => item.slug === requestedDocument)) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const targetId = libraryState.interestCompleted
        ? `fipa-document-${requestedDocument}`
        : 'fipa-interest-title';
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [documents, libraryState.interestCompleted, loading, requestedDocument]);

  const selectedVenue = useMemo(
    () => officialVenues.find((venue) => venue.id === form.venueId) || null,
    [form.venueId, officialVenues],
  );
  const venueNotFound = form.clubLink === 'yes' && form.venueId === FIPA_NOT_FOUND_VENUE_VALUE;
  const membershipApproved = libraryState.grantActive;
  const interestCompleted = libraryState.interestCompleted;
  const requestStatus = libraryState.status;
  const showInterestForm = !interestCompleted || editingInterest;
  const canRequestMembership = profileHasVenue(libraryState.interest);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
    setFormSuccess('');
  };

  const onVenueChange = (event) => {
    const venueId = event.target.value;
    setForm((current) => ({
      ...current,
      venueId,
      ...(venueId === FIPA_NOT_FOUND_VENUE_VALUE
        ? { country: '', city: '', venueName: '', location: '' }
        : {}),
    }));
    setFormError('');
  };

  const validationMessage = (key) => {
    const messages = {
      purposeCategoryRequired: t('fipaLibrary.validation.purposeCategoryRequired', 'Elige para qué quieres consultar la Biblioteca.'),
      purposeOtherRequired: t('fipaLibrary.validation.purposeOtherRequired', 'Cuéntanos brevemente el motivo de la consulta.'),
      playsPadbolRequired: t('fipaLibrary.validation.playsPadbolRequired', 'Indica si juegas Padbol o elige “Prefiero no decir”.'),
      clubLinkRequired: t('fipaLibrary.validation.clubLinkRequired', 'Indica si estás vinculado con una sede o elige “Prefiero no decir”.'),
      venueRequired: t('fipaLibrary.validation.venueRequired', 'Elige una sede oficial o “No encuentro mi cancha”.'),
      countryRequired: t('fipaLibrary.validation.countryRequired', 'Indica el país de la cancha.'),
      cityRequired: t('fipaLibrary.validation.cityRequired', 'Indica la ciudad de la cancha.'),
      venueNameRequired: t('fipaLibrary.validation.venueNameRequired', 'Indica el nombre de la cancha o club.'),
      locationRequired: t('fipaLibrary.validation.locationRequired', 'Indica una dirección o enlace de ubicación.'),
      purposeRequired: t('fipaLibrary.validation.purposeRequired', 'Confirma que leíste para qué usaremos estos datos.'),
      whatsappInvalid: t('fipaLibrary.validation.whatsappInvalid', 'Revisa el número de WhatsApp.'),
    };
    return messages[key] || t('fipaLibrary.errors.profile', 'No pudimos guardar la ficha.');
  };

  const saveInterest = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    setFormSuccess('');
    const validationError = validateFipaAccessRequestForm(form, officialVenues);
    if (validationError) {
      setFormError(validationMessage(validationError));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildFipaAccessRequestPayload(form, officialVenues);
      const response = await submitFipaInterestProfile({ accessToken, body: payload });
      const savedProfile = {
        purpose: payload.purpose,
        purpose_other: payload.purpose_other,
        plays_padbol: payload.plays_padbol,
        linked_to_club: payload.linked_to_club,
        sede_id: payload.sede_id,
        declared_sede_id: payload.sede_id,
        venue_not_listed: payload.cancha_no_encontrada,
        club_name: payload.nombre_cancha,
        country: payload.pais,
        city: payload.ciudad,
        address: payload.direccion_ubicacion,
        ...(normalizeSavedProfile(response?.profile) || {}),
      };
      setLibraryState((current) => ({
        ...current,
        interest: savedProfile,
        interestCompleted: response?.authenticated_access !== false,
      }));
      setEditingInterest(false);
      setFormSuccess(t('fipaLibrary.profileSaved', 'Ficha guardada. Ya puedes descargar el Reglamento y el Código de Conducta.'));
    } catch (error) {
      setFormError(friendlyApiError(error, t, 'fipaLibrary.errors.profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const requestMembership = async () => {
    if (!canRequestMembership || submittingMember) return;
    setMemberError('');
    setMemberSuccess('');
    setSubmittingMember(true);
    try {
      const response = await submitFipaAccessRequest({
        accessToken,
        body: memberRequestBodyFromProfile(libraryState.interest),
      });
      setLibraryState((current) => ({
        ...current,
        status: 'pending',
        request: {
          id: response?.request_id || null,
          status: response?.status || 'pending',
          reason_code: response?.reason_code || null,
        },
      }));
      setMemberSuccess(t('fipaLibrary.requestSent', 'Recibimos tu solicitud. Te avisaremos cuando termine la revisión.'));
    } catch (error) {
      if (error?.status === 409) {
        setLibraryState((current) => ({ ...current, status: 'pending' }));
      }
      setMemberError(friendlyApiError(error, t, 'fipaLibrary.errors.request'));
    } finally {
      setSubmittingMember(false);
    }
  };

  const startDownload = async (documentItem) => {
    if (!canAccessFipaDocument(documentItem, libraryState) || downloadingId) return;
    setDownloadError('');
    setDownloadingId(documentItem.id);
    try {
      await downloadFipaDocument({ accessToken, document: documentItem });
    } catch (error) {
      setDownloadError(friendlyApiError(error, t, 'fipaLibrary.errors.download'));
    } finally {
      setDownloadingId('');
    }
  };

  const verifyAge = async (event) => {
    event.preventDefault();
    if (ageSaving) return;
    setAgeError('');
    const assessment = assessAgeEligibility(birthDate);
    if (!assessment.allowed) {
      setAgeError(assessment.band === 'requires_verified_parent'
        ? t('auth.ageEligibilityParental')
        : t('auth.ageEligibilityInvalid'));
      return;
    }
    setAgeSaving(true);
    try {
      await registerCurrentAccountEligibility(assessment.birthDate, 'web_fipa_library');
      setEligibilityNonce((value) => value + 1);
    } catch (error) {
      setAgeError(String(error?.message || '').includes('parental')
        ? t('auth.ageEligibilityParental')
        : t('auth.ageEligibilityInvalid'));
    } finally {
      setAgeSaving(false);
    }
  };

  if (eligibilityStatus !== 'allowed') {
    return (
      <main className="fipa-documents-page">
        <AppHeader title={t('fipaLibrary.header', 'Biblioteca FIPA')} />
        <div className="fipa-documents-shell">
          <section className="fipa-documents-hero">
            <img className="fipa-documents-brand" src={padbolBrandLogoSrc('dark')} alt="Padbol" />
            <span>{t('fipaLibrary.eyebrow', 'DOCUMENTACIÓN OFICIAL')}</span>
            <h1>{t('fipaLibrary.title', 'Biblioteca FIPA')}</h1>
            <p>{t('fipaLibrary.intro', 'Consulta la documentación oficial de Padbol desde tu cuenta de Padbol Match.')}</p>
          </section>
          <section className="fipa-documents-section fipa-age-section" aria-live="polite">
            {eligibilityStatus === 'loading' ? <p>{t('general.loading')}</p> : null}
            {eligibilityStatus === 'required' ? (
              <form onSubmit={verifyAge}>
                <span>{t('fipaLibrary.age.eyebrow', 'VERIFICACIÓN MÍNIMA')}</span>
                <h2>{t('fipaLibrary.age.title', 'Antes de abrir la Biblioteca')}</h2>
                <p>{t('fipaLibrary.age.body', 'Solo necesitamos verificar la edad de la cuenta. No hace falta completar ahora el perfil deportivo ni elegir una experiencia.')}</p>
                <label>
                  <span>{t('perfil.birthDate', 'Fecha de nacimiento')}</span>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(event) => {
                      setBirthDate(event.target.value);
                      setAgeError('');
                    }}
                    autoComplete="bday"
                  />
                </label>
                <small>{t('auth.ageEligibilityHelp')}</small>
                {ageError ? <div className="fipa-documents-notice fipa-documents-notice--error" role="alert">{ageError}</div> : null}
                <button className="fipa-access-submit" type="submit" disabled={ageSaving}>
                  {ageSaving ? t('general.loading') : t('fipaLibrary.age.continue', 'Verificar y continuar')}
                </button>
              </form>
            ) : null}
            {eligibilityStatus === 'blocked' ? (
              <div className="fipa-access-status fipa-access-status--neutral">
                <strong>{t('fipaLibrary.age.unavailableTitle', 'Esta cuenta no puede acceder todavía')}</strong>
                <p>{t('fipaLibrary.age.unavailableBody', 'Las cuentas de 13 a 15 años requieren autorización parental verificable. Esa opción aún no está habilitada.')}</p>
                <button className="fipa-access-link-button" type="button" onClick={() => navigate('/')}>
                  {t('fipaLibrary.leaveLibrary', 'Volver a Padbol')}
                </button>
              </div>
            ) : null}
            {eligibilityStatus === 'error' ? (
              <div className="fipa-access-status fipa-access-status--neutral">
                <strong>{t('fipaLibrary.age.errorTitle', 'No pudimos verificar la cuenta')}</strong>
                <p>{t('fipaLibrary.age.errorBody', 'Por seguridad, la Biblioteca seguirá cerrada hasta confirmar la elegibilidad.')}</p>
                <button className="fipa-access-submit" type="button" onClick={() => setEligibilityNonce((value) => value + 1)}>
                  {t('general.retry', 'Reintentar')}
                </button>
                <button className="fipa-access-link-button" type="button" onClick={() => navigate('/')}>
                  {t('fipaLibrary.leaveLibrary', 'Volver a Padbol')}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="fipa-documents-page">
      <AppHeader title={t('fipaLibrary.header', 'Biblioteca FIPA')} />
      <div className="fipa-documents-shell">
        <section className="fipa-documents-hero">
          <span>{t('fipaLibrary.eyebrow', 'DOCUMENTACIÓN OFICIAL')}</span>
          <h1>{t('fipaLibrary.title', 'Biblioteca FIPA')}</h1>
          <p>{t('fipaLibrary.intro', 'Consulta la documentación oficial de Padbol desde tu cuenta de Padbol Match.')}</p>
          <div className="fipa-documents-account">
            <strong>{session?.user?.email}</strong>
            <small>{t('fipaLibrary.accountNote', 'Acceso identificado con tu cuenta')}</small>
          </div>
        </section>

        {serviceUnavailable ? (
          <div className="fipa-documents-notice fipa-documents-notice--warning" role="status">
            {t('fipaLibrary.servicePending', 'La conexión segura con la Biblioteca no está disponible ahora. El catálogo puede verse, pero las descargas y solicitudes permanecen cerradas.')}
          </div>
        ) : null}

        <section className="fipa-documents-section fipa-access-section" aria-labelledby="fipa-interest-title">
          <div className="fipa-documents-section-heading">
            <div>
              <span>{t('fipaLibrary.interestEyebrow', 'ANTES DE LA PRIMERA DESCARGA')}</span>
              <h2 id="fipa-interest-title">{t('fipaLibrary.interestTitle', 'Cuéntanos qué estás buscando')}</h2>
            </div>
            <p>{t('fipaLibrary.interestHelp', 'Es una ficha única y breve. No necesitas instalar la app, hacer un recorrido ni completar ahora tu perfil deportivo.')}</p>
          </div>

          {interestCompleted && !editingInterest ? (
            <div className="fipa-access-status fipa-access-status--approved" role="status">
              <strong>{t('fipaLibrary.profileReadyTitle', 'Ficha de interés guardada')}</strong>
              <p>{formSuccess || t('fipaLibrary.profileReadyBody', 'El Reglamento y el Código de Conducta ya están disponibles para tu cuenta.')}</p>
              <button
                className="fipa-access-link-button"
                type="button"
                onClick={() => {
                  setForm(formFromProfile(libraryState.interest));
                  setEditingInterest(true);
                  setFormSuccess('');
                }}
              >
                {t('fipaLibrary.editProfile', 'Actualizar ficha')}
              </button>
            </div>
          ) : null}

          {showInterestForm ? (
            <form className="fipa-access-form" onSubmit={saveInterest} noValidate>
              <label className="fipa-access-form__wide">
                <span>{t('fipaLibrary.form.purpose', '¿Para qué quieres consultar la Biblioteca?')}</span>
                <select value={form.purpose} onChange={(event) => updateForm('purpose', event.target.value)}>
                  <option value="">{t('fipaLibrary.form.choosePurpose', 'Elige una categoría')}</option>
                  {FIPA_INTEREST_PURPOSES.map((value) => (
                    <option key={value} value={value}>{t(`fipaLibrary.purpose.${PURPOSE_KEYS[value]}`, value)}</option>
                  ))}
                </select>
              </label>

              {form.purpose === 'otro' ? (
                <label className="fipa-access-form__wide">
                  <span>{t('fipaLibrary.form.purposeOther', 'Motivo de la consulta')}</span>
                  <input maxLength="240" value={form.purposeOther} onChange={(event) => updateForm('purposeOther', event.target.value)} />
                </label>
              ) : null}

              <label>
                <span>{t('fipaLibrary.form.playsPadbol', '¿Juegas Padbol?')}</span>
                <select value={form.playsPadbol} onChange={(event) => updateForm('playsPadbol', event.target.value)}>
                  <option value="">{t('fipaLibrary.form.chooseAnswer', 'Elige una opción')}</option>
                  {Object.entries(ANSWER_KEYS).map(([value, key]) => (
                    <option key={value} value={value}>{t(`fipaLibrary.answer.${key}`, value)}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t('fipaLibrary.form.clubLink', '¿Estás vinculado con un club o sede?')}</span>
                <select
                  value={form.clubLink}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      clubLink: value,
                      ...(value === 'yes' ? {} : { venueId: '', country: '', city: '', venueName: '', location: '' }),
                    }));
                    setFormError('');
                  }}
                >
                  <option value="">{t('fipaLibrary.form.chooseAnswer', 'Elige una opción')}</option>
                  {Object.entries(ANSWER_KEYS).map(([value, key]) => (
                    <option key={value} value={value}>{t(`fipaLibrary.answer.${key}`, value)}</option>
                  ))}
                </select>
              </label>

              {form.clubLink === 'yes' ? (
                <>
                  <label className="fipa-access-form__wide">
                    <span>{t('fipaLibrary.form.officialVenue', '¿Con qué sede o cancha estás vinculado?')}</span>
                    <select value={form.venueId} onChange={onVenueChange}>
                      <option value="">{t('fipaLibrary.form.chooseVenue', 'Elige una sede oficial')}</option>
                      {officialVenues.map((venue) => (
                        <option key={venue.id} value={venue.id}>{formatVenue(venue)}</option>
                      ))}
                      <option value={FIPA_NOT_FOUND_VENUE_VALUE}>{t('fipaLibrary.form.venueNotFound', 'No encuentro mi cancha')}</option>
                    </select>
                  </label>

                  {selectedVenue ? (
                    <div className="fipa-access-form__venue fipa-access-form__wide">
                      <strong>{selectedVenue.nombre}</strong>
                      <span>{[selectedVenue.direccion, selectedVenue.ciudad, selectedVenue.pais].filter(Boolean).join(' · ')}</span>
                      <small>{t('fipaLibrary.form.officialVenueConfirmed', 'Esta sede figura actualmente en el registro oficial.')}</small>
                    </div>
                  ) : null}

                  {venueNotFound ? (
                    <>
                      <div className="fipa-documents-notice fipa-documents-notice--neutral fipa-access-form__wide">
                        {t('fipaLibrary.form.notOfficialNotice', 'La cancha indicada no figura actualmente como sede oficial. Guardaremos los datos y nuestro equipo los revisará.')}
                      </div>
                      <label>
                        <span>{t('fipaLibrary.form.country', 'País')}</span>
                        <input value={form.country} onChange={(event) => updateForm('country', event.target.value)} autoComplete="country-name" />
                      </label>
                      <label>
                        <span>{t('fipaLibrary.form.city', 'Ciudad')}</span>
                        <input value={form.city} onChange={(event) => updateForm('city', event.target.value)} autoComplete="address-level2" />
                      </label>
                      <label>
                        <span>{t('fipaLibrary.form.venueName', 'Nombre de la cancha o club')}</span>
                        <input value={form.venueName} onChange={(event) => updateForm('venueName', event.target.value)} />
                      </label>
                      <label>
                        <span>{t('fipaLibrary.form.location', 'Dirección o enlace de ubicación')}</span>
                        <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} autoComplete="street-address" />
                      </label>
                    </>
                  ) : null}
                </>
              ) : null}

              <div className="fipa-access-form__privacy fipa-access-form__wide">
                <p>{t('fipaLibrary.form.purposeNotice', 'Padbol Internacional usará la ficha para conocer el interés en la documentación, administrar el acceso y, si solicitas acceso de miembro, verificar la relación declarada con una sede. El email de tu cuenta identifica la ficha y la solicitud.')}</p>
                <label className="fipa-access-checkbox">
                  <input
                    type="checkbox"
                    checked={form.purposeAcknowledged}
                    onChange={(event) => updateForm('purposeAcknowledged', event.target.checked)}
                  />
                  <span>{t('fipaLibrary.form.purposeAcknowledgement', 'Leí y comprendí la finalidad informada.')}</span>
                </label>
              </div>

              <div className="fipa-access-form__whatsapp fipa-access-form__wide">
                <label className="fipa-access-checkbox">
                  <input
                    type="checkbox"
                    checked={form.whatsappOptIn}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setForm((current) => ({
                        ...current,
                        whatsappOptIn: checked,
                        whatsapp: checked ? current.whatsapp || String(userProfile?.whatsapp || '') : '',
                      }));
                      setFormError('');
                    }}
                  />
                  <span>{t('fipaLibrary.form.whatsappConsent', 'Autorizo de forma opcional el contacto por WhatsApp relacionado con esta ficha o solicitud. Puedo revocarlo actualizando la ficha.')}</span>
                </label>
                {form.whatsappOptIn ? (
                  <label>
                    <span>{t('fipaLibrary.form.whatsapp', 'WhatsApp con código de país')}</span>
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={(event) => updateForm('whatsapp', event.target.value)}
                      placeholder="+54 9 11 0000 0000"
                      autoComplete="tel"
                    />
                  </label>
                ) : null}
              </div>

              {formError ? <div className="fipa-documents-notice fipa-documents-notice--error fipa-access-form__wide" role="alert">{formError}</div> : null}

              <div className="fipa-access-form__actions fipa-access-form__wide">
                <button className="fipa-access-submit" type="submit" disabled={submitting || serviceUnavailable}>
                  {submitting ? t('general.loading') : t('fipaLibrary.form.saveProfile', 'Guardar y continuar')}
                </button>
                {interestCompleted && editingInterest ? (
                  <button className="fipa-access-link-button" type="button" onClick={() => setEditingInterest(false)} disabled={submitting}>
                    {t('general.cancel', 'Cancelar')}
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        <section className="fipa-documents-section" aria-labelledby="fipa-documents-title">
          <div className="fipa-documents-section-heading">
            <div>
              <span>{t('fipaLibrary.catalogEyebrow', 'CATÁLOGO')}</span>
              <h2 id="fipa-documents-title">{t('fipaLibrary.catalogTitle', 'Documentos oficiales')}</h2>
            </div>
            <p>{t('fipaLibrary.catalogHelp', 'Después de guardar la ficha, el Reglamento y el Código de Conducta quedan disponibles. Los otros siete documentos requieren membresía aprobada.')}</p>
          </div>

          {downloadError ? <div className="fipa-documents-notice fipa-documents-notice--error" role="alert">{downloadError}</div> : null}

          <div className="fipa-documents-grid" aria-busy={loading}>
            {documents.map((documentItem, index) => {
              const allowed = canAccessFipaDocument(documentItem, libraryState);
              const isDownloading = downloadingId === documentItem.id;
              return (
                <article
                  id={`fipa-document-${documentItem.slug}`}
                  className={`fipa-document-card${allowed ? ' is-available' : ' is-locked'}${requestedDocument === documentItem.slug ? ' is-requested' : ''}`}
                  key={documentItem.id}
                >
                  <div className="fipa-document-card__number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="fipa-document-card__body">
                    <span className="fipa-document-card__access">
                      {!documentItem.published
                        ? t('fipaLibrary.notPublished', 'Documento aún no disponible')
                        : !interestCompleted
                        ? t('fipaLibrary.profileRequired', 'Completa la ficha de interés')
                        : documentItem.accessLevel === 'authenticated'
                          ? t('fipaLibrary.accountAccess', 'Incluido con tu cuenta')
                          : allowed
                            ? t('fipaLibrary.memberAccess', 'Membresía aprobada')
                            : t('fipaLibrary.memberRequired', 'Membresía requerida')}
                    </span>
                    <h3>{t(documentItem.titleKey, documentItem.fallbackTitle)}</h3>
                    {documentItem.version ? <small>v{documentItem.version}</small> : null}
                  </div>
                  <button
                    type="button"
                    disabled={!allowed || isDownloading || serviceUnavailable}
                    onClick={() => void startDownload(documentItem)}
                  >
                    {isDownloading
                      ? t('fipaLibrary.downloading', 'Preparando…')
                      : !documentItem.published
                        ? t('fipaLibrary.notAvailable', 'No disponible')
                      : allowed
                        ? t('fipaLibrary.download', 'Descargar PDF')
                        : t('fipaLibrary.locked', 'Acceso restringido')}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="fipa-documents-section fipa-access-section" aria-labelledby="fipa-access-title">
          <div className="fipa-documents-section-heading">
            <div>
              <span>{t('fipaLibrary.membershipEyebrow', 'ACCESO PARA MIEMBROS')}</span>
              <h2 id="fipa-access-title">{t('fipaLibrary.membershipTitle', 'Documentación institucional')}</h2>
            </div>
            <p>{t('fipaLibrary.membershipHelp', 'Los siete documentos internos se habilitan solo a miembros verificados o mediante aprobación expresa.')}</p>
          </div>

          {membershipApproved ? (
            <div className="fipa-access-status fipa-access-status--approved" role="status">
              <strong>{t('fipaLibrary.status.approvedTitle', 'Acceso habilitado')}</strong>
              <p>{t('fipaLibrary.status.approvedBody', 'Tu membresía está aprobada y puedes descargar todo el catálogo.')}</p>
            </div>
          ) : null}

          {requestStatus === 'pending' ? (
            <div className="fipa-access-status" role="status">
              <strong>{t('fipaLibrary.status.pendingTitle', 'Solicitud en revisión')}</strong>
              <p>{memberSuccess || t('fipaLibrary.status.pendingBody', 'Recibimos los datos guardados en tu ficha. Te avisaremos cuando haya una decisión.')}</p>
            </div>
          ) : null}

          {['rejected', 'revoked', 'expired'].includes(requestStatus) && !membershipApproved ? (
            <div className="fipa-access-status fipa-access-status--neutral" role="status">
              <strong>{t('fipaLibrary.status.notActiveTitle', 'El acceso no está habilitado actualmente')}</strong>
              <p>{t('fipaLibrary.status.notActiveBody', 'Puedes actualizar tu ficha y presentar una nueva solicitud. Esto no afecta tu cuenta de Padbol Match.')}</p>
            </div>
          ) : null}

          {interestCompleted && !membershipApproved && requestStatus !== 'pending' ? (
            <div className="fipa-member-request">
              {canRequestMembership ? (
                <p>{t('fipaLibrary.memberRequestReady', 'Usaremos los datos de sede ya guardados en tu ficha para revisar la solicitud.')}</p>
              ) : (
                <p>{t('fipaLibrary.memberRequestNeedsVenue', 'Para solicitar estos documentos debes indicar en la ficha que estás vinculado con una sede y elegirla o informar una cancha que todavía no aparece.')}</p>
              )}
              {memberError ? <div className="fipa-documents-notice fipa-documents-notice--error" role="alert">{memberError}</div> : null}
              <button
                className="fipa-access-submit"
                type="button"
                disabled={!canRequestMembership || submittingMember || serviceUnavailable}
                onClick={() => void requestMembership()}
              >
                {submittingMember ? t('general.loading') : t('fipaLibrary.requestMemberAccess', 'Solicitar acceso de miembro')}
              </button>
            </div>
          ) : null}
        </section>

        <p className="fipa-documents-footer-note">
          {t('fipaLibrary.securityNote', 'El acceso institucional es personal, vigente y revocable. No compartas enlaces ni documentos restringidos con terceros no autorizados.')}
        </p>
      </div>
    </main>
  );
}

export {
  ANSWER_KEYS,
  EMPTY_FORM,
  PURPOSE_KEYS,
  canAccessFipaDocument,
  friendlyApiError,
  formFromProfile,
  memberRequestBodyFromProfile,
  profileHasVenue,
};
