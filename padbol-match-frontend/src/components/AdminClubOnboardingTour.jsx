import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import './AdminClubOnboardingTour.css';
import { useTranslation } from 'react-i18next';

/** Coincide con lo pedido: no volver a mostrar el tour si ya se completó o saltó. */
export const ADMIN_CLUB_ONBOARDING_LS_KEY = 'onboarding_completado';

function buildOnboardingSteps(t) {
  return [
    {
      id: 'welcome',
      tab: null,
      scrollToId: null,
      title: t('admin.onboarding.welcomeTitle'),
      body: t('admin.onboarding.welcomeBody'),
    },
    {
      id: 'mi_sede',
      tab: 'mi_sede',
      scrollToId: null,
      title: t('nav.admin.mi_sede'),
      body: t('admin.onboarding.miSedeBody'),
    },
    {
      id: 'reservas',
      tab: 'reservas',
      scrollToId: null,
      title: t('nav.admin.reservas'),
      body: t('admin.onboarding.reservasBody'),
    },
    {
      id: 'torneos',
      tab: 'torneos',
      scrollToId: null,
      title: t('torneos.titulo'),
      body: t('admin.onboarding.torneosBody'),
    },
    {
      id: 'pagos',
      tab: 'mi_sede',
      scrollToId: 'admin-mi-sede-pagos',
      title: t('admin.onboarding.pagosTitle'),
      body: t('admin.onboarding.pagosBody'),
    },
    {
      id: 'listo',
      tab: null,
      scrollToId: null,
      title: t('general.success'),
      body: t('admin.onboarding.doneBody'),
    },
  ];
}

export function readOnboardingDone() {
  try {
    return localStorage.getItem(ADMIN_CLUB_ONBOARDING_LS_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markAdminClubOnboardingCompletado() {
  try {
    localStorage.setItem(ADMIN_CLUB_ONBOARDING_LS_KEY, 'true');
  } catch {
    /* ignore */
  }
}

/**
 * Tour guiado para admin_club (primer ingreso al panel).
 * @param {Object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {(tabId: string) => void} p.applyTab — actualiza pestaña activa + URL + sessionStorage (misma lógica que el strip).
 * @param {React.RefObject<HTMLElement | null>} p.tabsStripRef
 * @param {boolean} p.puedeVerMiSede — si no puede ver Mi Sede, se omiten pasos que la requieren.
 */
export default function AdminClubOnboardingTour({ open, onClose, applyTab, tabsStripRef, puedeVerMiSede }) {
  const { t } = useTranslation();
  const steps = useMemo(() => {
    const all = buildOnboardingSteps(t);
    if (puedeVerMiSede) return all;
    return all.filter((s) => s.tab !== 'mi_sede' && s.scrollToId !== 'admin-mi-sede-pagos');
  }, [puedeVerMiSede, t]);

  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const updateSpotlight = useCallback(() => {
    if (!open) {
      setSpotlight(null);
      return;
    }
    const step = steps[stepIndex];
    if (!step?.tab) {
      setSpotlight(null);
      return;
    }
    const root = tabsStripRef?.current;
    if (!root) {
      setSpotlight(null);
      return;
    }
    const btn = root.querySelector(`button[data-admin-tour-tab="${step.tab}"]`);
    if (!btn) {
      setSpotlight(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    setSpotlight({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [open, stepIndex, steps, tabsStripRef]);

  useLayoutEffect(() => {
    updateSpotlight();
  }, [updateSpotlight]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateSpotlight();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updateSpotlight]);

  useEffect(() => {
    if (!open) return;
    const step = steps[stepIndex];
    if (!step) return;
    if (step.tab) applyTab(step.tab);
    if (step.scrollToId) {
      const t = window.setTimeout(() => {
        document.getElementById(step.scrollToId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateSpotlight();
      }, 480);
      return () => window.clearTimeout(t);
    }
    const t2 = window.setTimeout(() => updateSpotlight(), 120);
    return () => window.clearTimeout(t2);
  }, [open, stepIndex, steps, applyTab, updateSpotlight]);

  const finish = useCallback(() => {
    markAdminClubOnboardingCompletado();
    onClose();
  }, [onClose]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, finish]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!open) return null;

  const step = steps[stepIndex] || steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="admin-club-onboarding-root" role="dialog" aria-modal="true" aria-labelledby="admin-club-onboarding-title">
      <div className="admin-club-onboarding-backdrop" aria-hidden onClick={skip} />
      {spotlight ? (
        <div
          className="admin-club-onboarding-spotlight"
          style={{
            top: spotlight.top - 6,
            left: spotlight.left - 6,
            width: spotlight.width + 12,
            height: spotlight.height + 12,
          }}
          aria-hidden
        />
      ) : null}
      <div className="admin-club-onboarding-card">
        <h2 id="admin-club-onboarding-title" className="admin-club-onboarding-title">
          {step.title}
        </h2>
        <p className="admin-club-onboarding-body">{step.body}</p>
        <div className="admin-club-onboarding-meta">
          Paso {stepIndex + 1} de {steps.length}
        </div>
        <div className="admin-club-onboarding-actions">
          <button type="button" className="admin-club-onboarding-btn admin-club-onboarding-btn--ghost" onClick={skip}>
            Saltar tour
          </button>
          <div className="admin-club-onboarding-nav-btns">
            <button type="button" className="admin-club-onboarding-btn admin-club-onboarding-btn--secondary" onClick={goPrev} disabled={isFirst}>
              Anterior
            </button>
            <button type="button" className="admin-club-onboarding-btn admin-club-onboarding-btn--primary" onClick={goNext}>
              {isLast ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
