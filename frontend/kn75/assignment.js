'use strict';
// KN-113: Giao diện phân công lead hàng loạt (checkbox, chọn tư vấn viên, xác nhận, báo kết quả).
(async () => {
    const { $, node, api, notice, requireRole } = KN75;
    const MAX = 1000;
    let page = 1, totalPages = 0, current = [], busy = false, epoch = 0, pending = null;
    const selected = new Set();

    function controls() {
        $('selection').textContent = 'Đã chọn ' + selected.size + ' lead';
        $('assign').disabled = busy || !selected.size || !$('counselor').value;
        $('clear').disabled = busy || !selected.size;
        $('all').disabled = busy || !current.length;
        $('all').checked = current.length > 0 && current.every(l => selected.has(l.id));
        $('all').indeterminate = !$('all').checked && current.some(l => selected.has(l.id));
        $('prev').disabled = busy || page <= 1;
        $('next').disabled = busy || page >= totalPages;
    }

    function ownerCell(l) {
        const td = node('td', l.counselorName || (l.assignedTo ? l.assignedTo : 'Chưa phân công'));
        if (l.ownerInactive) td.append(node('small', 'Đã nghỉ việc / bị khóa', 'failure'));
        return td;
    }

    async function load() {
        const sequence = ++epoch;
        busy = true; controls(); $('rows').replaceChildren();
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20', search: $('search').value.trim(),
                status: $('status').value, assignment: $('assignment').value });
            const result = await api('/api/kn75/leads?' + params);
            if (sequence !== epoch) return;
            current = result.data; totalPages = result.pagination.totalPages;
            if (page > Math.max(1, totalPages)) { page = Math.max(1, totalPages); busy = false; return load(); }
            current.forEach(l => {
                const row = node('tr');
                const pick = node('td'); const cb = node('input'); cb.type = 'checkbox';
                cb.checked = selected.has(l.id); cb.setAttribute('aria-label', 'Chọn ' + l.fullName);
                cb.addEventListener('change', () => {
                    if (cb.checked && selected.size >= MAX) { cb.checked = false; notice('Tối đa 1.000 lead mỗi lần.', true); return; }
                    if (cb.checked) selected.add(l.id); else selected.delete(l.id);
                    controls();
                });
                pick.append(cb);
                const name = node('td'); name.append(node('strong', l.fullName), node('small', l.code || l.id));
                const contact = node('td'); contact.append(node('span', l.phone), node('small', l.email));
                const status = node('td'); status.append(node('span', l.status, 'badge'));
                row.append(pick, name, contact, status, ownerCell(l));
                $('rows').append(row);
            });
            $('empty').hidden = current.length > 0;
            document.querySelector('.table-wrap').hidden = !current.length;
            $('pagination').textContent = 'Trang ' + page + ' / ' + Math.max(1, totalPages) + ' · ' + result.pagination.total + ' lead';
        } catch (e) {
            if (sequence === epoch) { current = []; notice(e.message, true); }
        } finally {
            if (sequence === epoch) { busy = false; controls(); }
        }
    }

    $('all').addEventListener('change', () => {
        const checked = $('all').checked;
        const adding = current.filter(l => !selected.has(l.id)).length;
        if (checked && selected.size + adding > MAX) { notice('Tối đa 1.000 lead mỗi lần.', true); controls(); return; }
        current.forEach(l => (checked ? selected.add(l.id) : selected.delete(l.id)));
        load();
    });
    $('clear').onclick = () => { selected.clear(); load(); };
    $('filters').onsubmit = e => { e.preventDefault(); if (busy) return; page = 1; load(); };
    $('prev').onclick = () => { if (!busy && page > 1) { page--; load(); } };
    $('next').onclick = () => { if (!busy && page < totalPages) { page++; load(); } };
    $('counselor').onchange = controls;

    // Bước xác nhận trước khi giao
    $('assign').onclick = () => {
        if (busy || !selected.size || !$('counselor').value) return;
        pending = { lead_ids: Array.from(selected), tu_van_vien_id: $('counselor').value, reason: $('reason').value.trim() };
        $('confirm-text').textContent = 'Giao ' + pending.lead_ids.length + ' lead cho ' +
            $('counselor').selectedOptions[0].textContent + '? Người phụ trách cũ (nếu có) sẽ không còn thấy các lead này.';
        $('confirm-reason').textContent = 'Lý do: ' + (pending.reason || 'Không cung cấp');
        $('confirm').showModal();
    };
    $('cancel-confirm').onclick = () => { $('confirm').close(); pending = null; };
    $('confirm').addEventListener('cancel', e => { if (busy) e.preventDefault(); else pending = null; });

    // Gửi và thông báo kết quả từng lead
    $('send').onclick = async () => {
        if (busy || !pending) return;
        busy = true; controls(); $('send').disabled = true; $('cancel-confirm').disabled = true;
        try {
            const r = await api('/api/kn75/assignments', { method: 'POST', body: JSON.stringify(pending) });
            r.successful.forEach(x => selected.delete(x.lead_id));
            $('summary').textContent = r.summary.successful + ' thành công · ' + r.summary.failed + ' không được giao.';
            $('details').replaceChildren();
            r.successful.forEach(x => $('details').append(node('li',
                x.lead_id + ': ' + (x.action === 'REASSIGNED' ? 'Đã chuyển giao' : 'Đã phân công') +
                (x.old_user_inactive ? ' (người cũ đã nghỉ việc)' : ''), 'success')));
            r.failed.forEach(x => $('details').append(node('li', x.lead_id + ': ' + x.message + ' [' + x.code + ']', 'failure')));
            $('result').hidden = false;
            notice(r.summary.failed ? 'Đã xử lý xong. Các lead lỗi vẫn được giữ trong lựa chọn.' : 'Phân công thành công.');
        } catch (e) {
            notice(e.message, true);
        } finally {
            busy = false; pending = null; $('confirm').close();
            $('send').disabled = false; $('cancel-confirm').disabled = false;
            await load();
        }
    };

    try {
        await requireRole('training_manager', 'Trang này chỉ dành cho Quản lý đào tạo.');
        const r = await api('/api/kn75/counselors');
        r.data.forEach(u => { const o = node('option', u.name + ' · ' + u.email); o.value = u.id; $('counselor').append(o); });
        if (!r.data.length) notice('Chưa có tư vấn viên đang hoạt động.', true);
        await load();
    } catch (e) {
        notice(e.message, true); controls();
    }
})();
