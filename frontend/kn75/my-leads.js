'use strict';
// KN-116: Danh sách lead của tư vấn viên theo phạm vi được giao + xem lịch sử chuyển giao.
(async () => {
    const { $, node, api, notice, date, requireRole } = KN75;
    let page = 1, totalPages = 0, busy = false, epoch = 0;
    let historyId = null, hpage = 1, htotal = 0, hepoch = 0;

    function controls() { $('prev').disabled = busy || page <= 1; $('next').disabled = busy || page >= totalPages; }

    async function load() {
        const sequence = ++epoch;
        busy = true; controls(); $('rows').replaceChildren();
        try {
            const query = new URLSearchParams({ page: String(page), limit: '20', search: $('search').value.trim(), status: $('status').value });
            const r = await api('/api/kn75/my-leads?' + query);
            if (sequence !== epoch) return;
            totalPages = r.pagination.totalPages;
            if (page > Math.max(1, totalPages)) { page = Math.max(1, totalPages); busy = false; return load(); }
            for (const l of r.data) {
                const row = node('tr'), name = node('td'), contact = node('td'), status = node('td'), action = node('td');
                name.append(node('strong', l.fullName), node('small', l.code || l.id));
                contact.append(node('span', l.phone), node('small', l.email));
                status.append(node('span', l.status, 'badge'));
                const button = node('button', 'Xem lịch sử', 'secondary'); button.type = 'button';
                button.onclick = () => {
                    historyId = l.id; hpage = 1;
                    $('history-title').textContent = 'Chuyển giao · ' + l.fullName;
                    $('history').showModal(); loadHistory();
                };
                action.append(button);
                row.append(name, contact, status, node('td', date(l.assignedAt)), action);
                $('rows').append(row);
            }
            $('empty').hidden = r.data.length > 0;
            document.querySelector('.table-wrap').hidden = !r.data.length;
            $('pagination').textContent = 'Trang ' + page + ' / ' + Math.max(1, totalPages) + ' · ' + r.pagination.total + ' lead';
        } catch (e) {
            if (sequence === epoch) notice(e.message, true);
        } finally {
            if (sequence === epoch) { busy = false; controls(); }
        }
    }

    async function loadHistory() {
        const sequence = ++hepoch;
        $('history-list').replaceChildren(); $('history-error').textContent = '';
        $('history-prev').disabled = true; $('history-next').disabled = true;
        try {
            const r = await api('/api/kn75/my-leads/' + encodeURIComponent(historyId) + '/history?page=' + hpage + '&limit=10');
            if (sequence !== hepoch) return;
            htotal = r.pagination.totalPages;
            r.data.forEach(h => {
                const item = node('li');
                item.append(
                    node('strong', (h.old_user_name || 'Chưa phân công') + (h.old_user_inactive ? ' (đã nghỉ)' : '') + ' → ' + h.new_user_name),
                    node('p', 'Người thực hiện: ' + h.performed_by_name),
                    node('p', 'Lý do: ' + (h.reason || 'Không cung cấp')),
                    node('small', date(h.transferred_at)));
                $('history-list').append(item);
            });
            if (!r.data.length) $('history-list').append(node('li', 'Chưa có lịch sử chuyển giao.'));
            $('history-page').textContent = 'Trang ' + hpage + ' / ' + Math.max(1, htotal);
            $('history-prev').disabled = hpage <= 1; $('history-next').disabled = hpage >= htotal;
        } catch (e) {
            if (sequence === hepoch) $('history-error').textContent = e.message;
        }
    }

    $('filters').onsubmit = e => { e.preventDefault(); if (busy) return; page = 1; notice(''); load(); };
    $('prev').onclick = () => { if (!busy && page > 1) { page--; load(); } };
    $('next').onclick = () => { if (!busy && page < totalPages) { page++; load(); } };
    $('history-prev').onclick = () => { if (hpage > 1) { hpage--; loadHistory(); } };
    $('history-next').onclick = () => { if (hpage < htotal) { hpage++; loadHistory(); } };
    $('close-history').onclick = () => { $('history').close(); hepoch++; };
    $('history').addEventListener('cancel', () => hepoch++);

    try {
        await requireRole('admissions', 'Trang này dành cho tư vấn viên.');
        await load();
    } catch (e) {
        notice(e.message, true);
    }
})();
