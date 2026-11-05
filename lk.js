/* Live K · shared config + helpers for the opening-night pages */
window.LK = (function () {
  const CONFIG = {
    supabaseUrl: 'https://wuzsquhkdndrqxyrgpqs.supabase.co',
    supabaseKey: 'sb_publishable_eUvxmrEmaJoQhwYGb64hFg_r3Bk_CRT', // publishable key: safe in a browser
    eventId: 'baltimore-opening',
    timeZone: 'America/New_York',
    mapsQuery: 'Live K Karaoke Bar, 301 Mission Blvd Suite 1102, Baltimore, MD 21230'
  };

  // Calls a Postgres function through the REST API. Raises Error(message) on failure;
  // message is the short code raised in SQL (bad_phone, rsvp_closed, ...) or 'network'.
  async function rpc(fn, params, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), (opts && opts.timeoutMs) || 15000);
    let res;
    try {
      res = await fetch(CONFIG.supabaseUrl + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(params || {}),
        signal: ctrl.signal,
        cache: 'no-store'
      });
    } catch (e) {
      clearTimeout(timer);
      throw new Error('network');
    }
    clearTimeout(timer);
    let body = null;
    const text = await res.text();
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
    if (!res.ok) {
      const msg = (body && (body.message || body.error || body.hint)) || ('http_' + res.status);
      throw new Error(String(msg).trim());
    }
    return body;
  }

  // Date helpers: everything is shown in the venue's time zone, whatever the viewer's clock says.
  function fmtDate(iso, lang) {
    const d = new Date(iso);
    const loc = lang === 'zh' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(loc, { timeZone: CONFIG.timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  }
  function fmtTime(iso, lang) {
    const d = new Date(iso);
    const loc = lang === 'zh' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(loc, { timeZone: CONFIG.timeZone, hour: 'numeric', minute: '2-digit' }).format(d);
  }
  function fmtClock(iso) {
    return new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  // 20261113T190000 in venue local time, for calendar links
  function calLocal(iso) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(iso));
    const g = (t) => parts.find((p) => p.type === t).value;
    const hh = g('hour') === '24' ? '00' : g('hour');
    return g('year') + g('month') + g('day') + 'T' + hh + g('minute') + g('second');
  }
  function googleCalendarUrl(ev) {
    const start = new Date(ev.starts_at);
    const end = new Date(start.getTime() + 5 * 3600 * 1000);
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: ev.name,
      dates: calLocal(start.toISOString()) + '/' + calLocal(end.toISOString()),
      ctz: CONFIG.timeZone,
      location: ev.address || '',
      details: (ev.venue || '') + (ev.entrance_note ? ' · ' + ev.entrance_note : '')
    });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  function icsText(ev, ticket) {
    const start = new Date(ev.starts_at);
    const end = new Date(start.getTime() + 5 * 3600 * 1000);
    const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Live K//Opening//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + (ticket ? ticket.id : ev.id) + '@livek',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      'DTSTART;TZID=' + CONFIG.timeZone + ':' + calLocal(start.toISOString()),
      'DTEND;TZID=' + CONFIG.timeZone + ':' + calLocal(end.toISOString()),
      'SUMMARY:' + esc(ev.name),
      'LOCATION:' + esc(ev.address),
      'DESCRIPTION:' + esc((ev.venue || '') + (ev.entrance_note ? ' - ' + ev.entrance_note : '') + (ticket ? ' - Your code: ' + ticket.code : '')),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }
  function mapsUrl() {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CONFIG.mapsQuery);
  }
  function ticketUrl(id) {
    const base = location.href.replace(/[^/]*$/, '');
    return base + 'ticket.html?t=' + encodeURIComponent(id);
  }

  // Language: ?lang=zh, saved choice, else browser
  function detectLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh' || q === 'en') return q;
    try { const s = localStorage.getItem('lk_lang'); if (s === 'zh' || s === 'en') return s; } catch (e) {}
    return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  }
  function saveLang(l) { try { localStorage.setItem('lk_lang', l); } catch (e) {} }

  function formatPhoneDisplay(d) {
    if (!d) return '';
    if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    return d;
  }

  return { CONFIG, rpc, fmtDate, fmtTime, fmtClock, googleCalendarUrl, icsText, mapsUrl, ticketUrl, detectLang, saveLang, formatPhoneDisplay };
})();
