/**
 * Traducciones de primera capa para los mercados que comparten el catálogo
 * inglés como respaldo. Así cada pantalla siempre muestra texto legible y
 * nunca claves técnicas mientras se completa la revisión editorial total.
 */
const locale = (general, nav, publicNav, hero) => ({ general, nav, publicSite: { nav: publicNav, hero } });

export const ADDITIONAL_LOCALE_OVERRIDES = {
  'fa-IR': locale(
    { language: 'زبان', loading: 'در حال بارگذاری…', confirm: 'تأیید', cancel: 'لغو', close: 'بستن', save: 'ذخیره', edit: 'ویرایش', delete: 'حذف', search: 'جستجو', back: 'بازگشت', continue: 'ادامه', accept: 'پذیرفتن', optional: 'اختیاری' },
    { mainAria: 'ناوبری اصلی', perfil: 'نمایه', jugar: 'بازی', competir: 'رقابت', notificaciones: 'اعلان‌ها', search: 'جستجو', logout: 'خروج', backToHub: 'بازگشت', myProfile: 'نمایه من', adminPanel: 'پنل مدیریت' },
    { platform: 'پلتفرم', players: 'برای بازیکنان', venues: 'برای باشگاه‌ها', download: 'دانلود برنامه', login: 'ورود', community: 'جامعه', scoreboard: 'تابلوی امتیازات' },
    { claim: 'اپلیکیشن ورزشی که همه‌چیز را به هم متصل می‌کند.', lead: 'بازیکنان، باشگاه‌ها، مسابقات، تورنمنت‌ها، رتبه‌بندی، جامعه و مدیریت؛ همه در یک پلتفرم.', ctaExplore: 'آشنایی با پلتفرم', ctaPlay: 'می‌خواهم بازی کنم', ctaVenue: 'می‌خواهم Padbol Match را به باشگاهم اضافه کنم' },
  ),
  'nl-BE': locale(
    { language: 'Taal', loading: 'Laden…', confirm: 'Bevestigen', cancel: 'Annuleren', close: 'Sluiten', save: 'Opslaan', edit: 'Bewerken', delete: 'Verwijderen', search: 'Zoeken', back: 'Terug', continue: 'Doorgaan', accept: 'Accepteren', optional: 'Optioneel' },
    { mainAria: 'Hoofdnavigatie', perfil: 'Profiel', jugar: 'Spelen', competir: 'Competitie', notificaciones: 'Meldingen', search: 'Zoeken', logout: 'Afmelden', backToHub: 'Terug', myProfile: 'Mijn profiel', adminPanel: 'Beheerpaneel' },
    { platform: 'Platform', players: 'Voor spelers', venues: 'Voor clubs', download: 'Download de app', login: 'Aanmelden', community: 'Community', scoreboard: 'Scorebord' },
    { claim: 'De sportapp die alles verbindt.', lead: 'Spelers, clubs, wedstrijden, toernooien, ranking, community en beheer op één platform.', ctaExplore: 'Ontdek het platform', ctaPlay: 'Ik wil spelen', ctaVenue: 'Ik wil Padbol Match aanbieden' },
  ),
  'nl-NL': locale(
    { language: 'Taal', loading: 'Laden…', confirm: 'Bevestigen', cancel: 'Annuleren', close: 'Sluiten', save: 'Opslaan', edit: 'Bewerken', delete: 'Verwijderen', search: 'Zoeken', back: 'Terug', continue: 'Doorgaan', accept: 'Accepteren', optional: 'Optioneel' },
    { mainAria: 'Hoofdnavigatie', perfil: 'Profiel', jugar: 'Spelen', competir: 'Competitie', notificaciones: 'Meldingen', search: 'Zoeken', logout: 'Uitloggen', backToHub: 'Terug', myProfile: 'Mijn profiel', adminPanel: 'Beheerpaneel' },
    { platform: 'Platform', players: 'Voor spelers', venues: 'Voor locaties', download: 'Download de app', login: 'Inloggen', community: 'Community', scoreboard: 'Scorebord' },
    { claim: 'De sportapp die alles verbindt.', lead: 'Spelers, locaties, wedstrijden, toernooien, ranking, community en beheer op één platform.', ctaExplore: 'Ontdek het platform', ctaPlay: 'Ik wil spelen', ctaVenue: 'Ik wil Padbol Match aanbieden' },
  ),
  sv: locale(
    { language: 'Språk', loading: 'Laddar…', confirm: 'Bekräfta', cancel: 'Avbryt', close: 'Stäng', save: 'Spara', edit: 'Redigera', delete: 'Ta bort', search: 'Sök', back: 'Tillbaka', continue: 'Fortsätt', accept: 'Godkänn', optional: 'Valfritt' },
    { mainAria: 'Huvudnavigering', perfil: 'Profil', jugar: 'Spela', competir: 'Tävla', notificaciones: 'Aviseringar', search: 'Sök', logout: 'Logga ut', backToHub: 'Tillbaka', myProfile: 'Min profil', adminPanel: 'Administrationspanel' },
    { platform: 'Plattform', players: 'För spelare', venues: 'För anläggningar', download: 'Ladda ner appen', login: 'Logga in', community: 'Gemenskap', scoreboard: 'Resultattavla' },
    { claim: 'Sportappen som kopplar ihop allt.', lead: 'Spelare, anläggningar, matcher, turneringar, ranking, gemenskap och administration på en plattform.', ctaExplore: 'Utforska plattformen', ctaPlay: 'Jag vill spela', ctaVenue: 'Jag vill erbjuda Padbol Match' },
  ),
  'pt-PT': locale(
    { language: 'Idioma', loading: 'A carregar…', confirm: 'Confirmar', cancel: 'Cancelar', close: 'Fechar', save: 'Guardar', edit: 'Editar', delete: 'Eliminar', search: 'Pesquisar', back: 'Voltar', continue: 'Continuar', accept: 'Aceitar', optional: 'Opcional' },
    { mainAria: 'Navegação principal', perfil: 'Perfil', jugar: 'Jogar', competir: 'Competir', notificaciones: 'Notificações', search: 'Pesquisar', logout: 'Terminar sessão', backToHub: 'Voltar', myProfile: 'O meu perfil', adminPanel: 'Painel de administração' },
    { platform: 'Plataforma', players: 'Para jogadores', venues: 'Para clubes', download: 'Descarregar a aplicação', login: 'Iniciar sessão', community: 'Comunidade', scoreboard: 'Marcador' },
    { claim: 'A aplicação desportiva que liga tudo.', lead: 'Jogadores, clubes, jogos, torneios, ranking, comunidade e gestão numa única plataforma.', ctaExplore: 'Explorar a plataforma', ctaPlay: 'Quero jogar', ctaVenue: 'Quero implementar o Padbol Match' },
  ),
  el: locale(
    { language: 'Γλώσσα', loading: 'Φόρτωση…', confirm: 'Επιβεβαίωση', cancel: 'Ακύρωση', close: 'Κλείσιμο', save: 'Αποθήκευση', edit: 'Επεξεργασία', delete: 'Διαγραφή', search: 'Αναζήτηση', back: 'Πίσω', continue: 'Συνέχεια', accept: 'Αποδοχή', optional: 'Προαιρετικό' },
    { mainAria: 'Κύρια πλοήγηση', perfil: 'Προφίλ', jugar: 'Παίξε', competir: 'Αγωνίσου', notificaciones: 'Ειδοποιήσεις', search: 'Αναζήτηση', logout: 'Αποσύνδεση', backToHub: 'Πίσω', myProfile: 'Το προφίλ μου', adminPanel: 'Πίνακας διαχείρισης' },
    { platform: 'Πλατφόρμα', players: 'Για παίκτες', venues: 'Για αθλητικούς χώρους', download: 'Λήψη εφαρμογής', login: 'Σύνδεση', community: 'Κοινότητα', scoreboard: 'Πίνακας σκορ' },
    { claim: 'Η αθλητική εφαρμογή που συνδέει τα πάντα.', lead: 'Παίκτες, χώροι, αγώνες, τουρνουά, κατάταξη, κοινότητα και διαχείριση σε μία πλατφόρμα.', ctaExplore: 'Εξερεύνηση πλατφόρμας', ctaPlay: 'Θέλω να παίξω', ctaVenue: 'Θέλω να εντάξω το Padbol Match' },
  ),
  hu: locale(
    { language: 'Nyelv', loading: 'Betöltés…', confirm: 'Megerősítés', cancel: 'Mégse', close: 'Bezárás', save: 'Mentés', edit: 'Szerkesztés', delete: 'Törlés', search: 'Keresés', back: 'Vissza', continue: 'Folytatás', accept: 'Elfogadás', optional: 'Nem kötelező' },
    { mainAria: 'Fő navigáció', perfil: 'Profil', jugar: 'Játék', competir: 'Verseny', notificaciones: 'Értesítések', search: 'Keresés', logout: 'Kijelentkezés', backToHub: 'Vissza', myProfile: 'Saját profil', adminPanel: 'Adminisztrációs panel' },
    { platform: 'Platform', players: 'Játékosoknak', venues: 'Sportlétesítményeknek', download: 'Alkalmazás letöltése', login: 'Bejelentkezés', community: 'Közösség', scoreboard: 'Eredményjelző' },
    { claim: 'A sportalkalmazás, amely mindent összeköt.', lead: 'Játékosok, sportlétesítmények, mérkőzések, versenyek, ranglista, közösség és kezelés egyetlen platformon.', ctaExplore: 'A platform felfedezése', ctaPlay: 'Játszani szeretnék', ctaVenue: 'Szeretném bevezetni a Padbol Match-et' },
  ),
  he: locale(
    { language: 'שפה', loading: 'טוען…', confirm: 'אישור', cancel: 'ביטול', close: 'סגירה', save: 'שמירה', edit: 'עריכה', delete: 'מחיקה', search: 'חיפוש', back: 'חזרה', continue: 'המשך', accept: 'אישור', optional: 'אופציונלי' },
    { mainAria: 'ניווט ראשי', perfil: 'פרופיל', jugar: 'לשחק', competir: 'להתחרות', notificaciones: 'התראות', search: 'חיפוש', logout: 'התנתקות', backToHub: 'חזרה', myProfile: 'הפרופיל שלי', adminPanel: 'לוח ניהול' },
    { platform: 'פלטפורמה', players: 'לשחקנים', venues: 'למועדונים', download: 'הורדת האפליקציה', login: 'כניסה', community: 'קהילה', scoreboard: 'לוח תוצאות' },
    { claim: 'אפליקציית הספורט שמחברת הכול.', lead: 'שחקנים, מועדונים, משחקים, טורנירים, דירוג, קהילה וניהול בפלטפורמה אחת.', ctaExplore: 'לגלות את הפלטפורמה', ctaPlay: 'אני רוצה לשחק', ctaVenue: 'אני רוצה לצרף את Padbol Match' },
  ),
  pl: locale(
    { language: 'Język', loading: 'Ładowanie…', confirm: 'Potwierdź', cancel: 'Anuluj', close: 'Zamknij', save: 'Zapisz', edit: 'Edytuj', delete: 'Usuń', search: 'Szukaj', back: 'Wstecz', continue: 'Kontynuuj', accept: 'Akceptuj', optional: 'Opcjonalne' },
    { mainAria: 'Nawigacja główna', perfil: 'Profil', jugar: 'Graj', competir: 'Rywalizuj', notificaciones: 'Powiadomienia', search: 'Szukaj', logout: 'Wyloguj się', backToHub: 'Wstecz', myProfile: 'Mój profil', adminPanel: 'Panel administracyjny' },
    { platform: 'Platforma', players: 'Dla graczy', venues: 'Dla obiektów', download: 'Pobierz aplikację', login: 'Zaloguj się', community: 'Społeczność', scoreboard: 'Tablica wyników' },
    { claim: 'Aplikacja sportowa, która łączy wszystko.', lead: 'Gracze, obiekty, mecze, turnieje, ranking, społeczność i zarządzanie na jednej platformie.', ctaExplore: 'Poznaj platformę', ctaPlay: 'Chcę grać', ctaVenue: 'Chcę wdrożyć Padbol Match' },
  ),
  uk: locale(
    { language: 'Мова', loading: 'Завантаження…', confirm: 'Підтвердити', cancel: 'Скасувати', close: 'Закрити', save: 'Зберегти', edit: 'Редагувати', delete: 'Видалити', search: 'Пошук', back: 'Назад', continue: 'Продовжити', accept: 'Прийняти', optional: 'Необов’язково' },
    { mainAria: 'Головна навігація', perfil: 'Профіль', jugar: 'Грати', competir: 'Змагатися', notificaciones: 'Сповіщення', search: 'Пошук', logout: 'Вийти', backToHub: 'Назад', myProfile: 'Мій профіль', adminPanel: 'Панель адміністратора' },
    { platform: 'Платформа', players: 'Для гравців', venues: 'Для спортивних клубів', download: 'Завантажити застосунок', login: 'Увійти', community: 'Спільнота', scoreboard: 'Табло' },
    { claim: 'Спортивний застосунок, що об’єднує все.', lead: 'Гравці, клуби, матчі, турніри, рейтинг, спільнота та керування на одній платформі.', ctaExplore: 'Переглянути платформу', ctaPlay: 'Хочу грати', ctaVenue: 'Хочу підключити Padbol Match' },
  ),
  af: locale(
    { language: 'Taal', loading: 'Laai…', confirm: 'Bevestig', cancel: 'Kanselleer', close: 'Sluit', save: 'Stoor', edit: 'Wysig', delete: 'Verwyder', search: 'Soek', back: 'Terug', continue: 'Gaan voort', accept: 'Aanvaar', optional: 'Opsioneel' },
    { mainAria: 'Hoofnavigasie', perfil: 'Profiel', jugar: 'Speel', competir: 'Kompeteer', notificaciones: 'Kennisgewings', search: 'Soek', logout: 'Teken uit', backToHub: 'Terug', myProfile: 'My profiel', adminPanel: 'Administrasiepaneel' },
    { platform: 'Platform', players: 'Vir spelers', venues: 'Vir sportklubs', download: 'Laai die toepassing af', login: 'Teken in', community: 'Gemeenskap', scoreboard: 'Telbord' },
    { claim: 'Die sporttoepassing wat alles verbind.', lead: 'Spelers, sportklubs, wedstryde, toernooie, ranglys, gemeenskap en bestuur op een platform.', ctaExplore: 'Verken die platform', ctaPlay: 'Ek wil speel', ctaVenue: 'Ek wil Padbol Match aanbied' },
  ),
  cs: locale(
    { language: 'Jazyk', loading: 'Načítání…', confirm: 'Potvrdit', cancel: 'Zrušit', close: 'Zavřít', save: 'Uložit', edit: 'Upravit', delete: 'Smazat', search: 'Hledat', back: 'Zpět', continue: 'Pokračovat', accept: 'Přijmout', optional: 'Volitelné' },
    { mainAria: 'Hlavní navigace', perfil: 'Profil', jugar: 'Hrát', competir: 'Soutěžit', notificaciones: 'Oznámení', search: 'Hledat', logout: 'Odhlásit se', backToHub: 'Zpět', myProfile: 'Můj profil', adminPanel: 'Panel správy' },
    { platform: 'Platforma', players: 'Pro hráče', venues: 'Pro sportovní kluby', download: 'Stáhnout aplikaci', login: 'Přihlásit se', community: 'Komunita', scoreboard: 'Výsledková tabule' },
    { claim: 'Sportovní aplikace, která propojuje vše.', lead: 'Hráči, kluby, zápasy, turnaje, žebříček, komunita a správa na jedné platformě.', ctaExplore: 'Prozkoumat platformu', ctaPlay: 'Chci hrát', ctaVenue: 'Chci zavést Padbol Match' },
  ),
};
