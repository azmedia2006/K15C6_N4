/* KN-156: Saved sessions are separate from the KN-154 unsaved preview. */
(() => {
    let saved = [], people = [], editingSaved = false, actionSession = null;
    const el = id => document.getElementById(id);
    const escape = escapeHtml;
    const request = async (url, method = 'GET', body) => {
        const response = await fetch(url, { method, headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Không thể thực hiện thao tác.');
        return result;
    };
    const notify = result => {
        showToast(result.message || 'Đã lưu.', 'success');
        if (result.notificationWarning) showToast(result.notificationWarning, 'info');
    };
    const disabledStyle = document.createElement('style'); disabledStyle.textContent = '#saved-session-panel button:disabled{opacity:.4;cursor:not-allowed;background:#eef1f6}'; document.head.appendChild(disabledStyle);
    const card = document.createElement('section');
    card.className = 'preview-pane'; card.id = 'saved-session-panel'; card.style.margin = '24px 0';
    card.innerHTML = `<div class="preview-toolbar"><div><h3>Quản lý buổi học đã lưu · KN-156</h3><p>Sửa, dời lịch hoặc hủy một buổi. Buổi đã điểm danh bị khóa; hủy phải có lý do.</p></div><a class="btn btn-secondary" href="/Notifications.html">Thông báo của tôi</a></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;padding:16px"><select id="saved-class" class="form-select" aria-label="Lớp có lịch đã lưu" style="max-width:480px"></select><button id="saved-refresh" class="btn btn-secondary">Tải lại</button><button id="saved-members" class="btn btn-secondary">Học viên nhận thông báo</button></div>
        <p id="saved-message" role="status" style="padding:0 16px"></p><div class="table-responsive"><table class="schedule-table"><thead><tr><th>Buổi</th><th>Ngày / giờ</th><th>Phòng / giảng viên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="saved-tbody"></tbody></table></div>`;
    document.querySelector('main').appendChild(card);
    const modal = document.createElement('div'); modal.id = 'session-action-modal'; modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-container"><div class="modal-header"><h4 id="session-action-title"></h4><button class="btn-icon" id="action-close" aria-label="Đóng">✕</button></div><form id="session-action-form"><div class="modal-body" id="session-action-body"></div><p id="session-action-error" role="alert" style="color:#b91c1c;padding:0 24px"></p><div class="modal-footer"><button type="button" class="btn btn-secondary" id="action-back">Đóng</button><button type="submit" class="btn btn-primary" id="action-submit">Xác nhận</button></div></form></div>`;
    document.body.appendChild(modal);
    const close = () => modal.classList.remove('open'); el('action-close').onclick = close; el('action-back').onclick = close;
    const show = (title, html, submit = true) => {
        el('session-action-title').textContent = title; el('session-action-body').innerHTML = html;
        el('session-action-error').textContent = ''; el('action-submit').hidden = !submit; modal.classList.add('open');
    };
    async function refreshClasses() {
        const result = await request('/api/schedules/classes'); const selected = el('saved-class').value;
        el('saved-class').replaceChildren(...result.classes.map(c => { const option = document.createElement('option'); option.value = c.id; option.textContent = `${c.code} — ${c.name}`; return option; }));
        if (result.classes.some(c => c.id === selected)) el('saved-class').value = selected;
        await refresh();
    }
    async function refresh() {
        try {
            if (!el('saved-class').value) return;
            const result = await request(`/api/schedules/${encodeURIComponent(el('saved-class').value)}`);
            saved = result.sessions;
            el('saved-message').textContent = saved.length ? `${saved.length} buổi (bao gồm buổi hủy). Thao tác lưu đồng thời lịch, lịch sử và thông báo trong ứng dụng.` : 'Lớp chưa có lịch. Sinh bản xem trước và lưu chính thức ở phía trên.';
            render();
        } catch (error) { el('saved-message').textContent = error.message; }
    }
    function render() {
        el('saved-tbody').innerHTML = saved.map((s, index) => `<tr><td>Buổi ${Number(s.sessionNumber)}</td><td>${escape(s.date)}<br>${escape(s.startTime)}–${escape(s.endTime)}</td><td>${escape(s.room)}<br>${escape(s.instructor)}</td><td><strong>${s.status === 'cancelled' ? 'Đã hủy' : s.status === 'completed' || s.attendanceTaken ? 'Đã điểm danh 🔒' : 'Đã xếp lịch'}</strong><br><small>${escape(s.lockReason || '')}</small>${s.cancelReason ? '<br>Lý do: ' + escape(s.cancelReason) : ''}</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" data-action="edit" data-index="${index}" ${!s.editable ? 'disabled' : ''}>Sửa / dời</button><button class="btn btn-secondary btn-sm" data-action="cancel" data-index="${index}" ${!s.editable ? 'disabled' : ''}>Hủy buổi</button><button class="btn btn-secondary btn-sm" data-action="history" data-index="${index}">Lịch sử</button><button class="btn btn-secondary btn-sm" data-action="attendance" data-index="${index}" ${!s.editable ? 'disabled' : ''}>Điểm danh</button></div></td></tr>`).join('') || '<tr><td colspan="5">Chưa có buổi học đã lưu.</td></tr>';
    }
    const originalOpen = openEditSessionModal, originalSave = handleSaveSessionEdit;
    openEditSessionModal = id => { editingSaved = false; originalOpen(id); };
    function editSaved(session) {
        if (!session.editable) return showToast(session.lockReason, 'error');
        editingSaved = true; actionSession = session;
        el('edit-session-id').value = session.id; el('edit-session-label').value = `Buổi ${session.sessionNumber} — bản đã lưu`;
        for (const [id, key] of [['edit-date','date'],['edit-start-time','startTime'],['edit-end-time','endTime'],['edit-room','room'],['edit-instructor','instructor'],['edit-lesson-topic','lessonTopic'],['edit-note','note']]) el(id).value = session[key] || '';
        el('edit-session-modal').classList.add('open');
    }
    handleSaveSessionEdit = async event => {
        if (!editingSaved) return originalSave(event);
        event.preventDefault();
        const button = event.target.querySelector('[type="submit"]'); button.disabled = true;
        try {
            const teacher = people.find(p => p.type === 'instructor' && p.name === el('edit-instructor').value.trim());
            const result = await request(`/api/schedules/session/${encodeURIComponent(actionSession.id)}`, 'PUT', {
                date: el('edit-date').value, startTime: el('edit-start-time').value, endTime: el('edit-end-time').value,
                room: el('edit-room').value.trim(), instructor: el('edit-instructor').value.trim(), instructorId: teacher?.id || null,
                lessonTopic: el('edit-lesson-topic').value.trim(), note: el('edit-note').value.trim(), version: actionSession.version
            });
            closeEditModal(); notify(result); await refresh();
        } catch (error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
    };
    el('saved-tbody').onclick = async event => {
        const button = event.target.closest('button[data-action]'); if (!button) return;
        const session = saved[Number(button.dataset.index)]; actionSession = session;
        try {
            if (button.dataset.action === 'edit') {
                const result = await request(`/api/schedules/session/${encodeURIComponent(session.id)}`); editSaved(result.session); return;
            }
            if (button.dataset.action === 'history') {
                const result = await request(`/api/schedules/session/${encodeURIComponent(session.id)}/history`);
                show('Lịch sử thay đổi buổi học', result.history.map(h => `<article style="border-bottom:1px solid #ddd;padding:12px 0"><strong>${escape(h.action)} · ${escape(h.actorName)}</strong><p>${escape(new Date(h.at).toLocaleString('vi-VN'))}${h.reason ? ' · ' + escape(h.reason) : ''}</p><p>Trước: ${escape(h.before.date)} ${escape(h.before.startTime)}–${escape(h.before.endTime)}, ${escape(h.before.room)}, ${escape(h.before.instructor)} (${escape(h.before.status)})</p><p>Sau: ${escape(h.after.date)} ${escape(h.after.startTime)}–${escape(h.after.endTime)}, ${escape(h.after.room)}, ${escape(h.after.instructor)} (${escape(h.after.status)})</p></article>`).join('') || '<p>Chưa có thay đổi.</p>', false); return;
            }
            if (button.dataset.action === 'cancel') {
                show(`Hủy buổi ${session.sessionNumber}`, '<p>Hủy mềm, không xóa dữ liệu. Học viên, giảng viên có tài khoản liên kết sẽ nhận thông báo trong ứng dụng.</p><label for="cancel-reason">Lý do hủy (bắt buộc)</label><textarea id="cancel-reason" class="form-input" required maxlength="1000" rows="4"></textarea>');
                el('session-action-form').onsubmit = e => commitAction(e, () => request(`/api/schedules/session/${encodeURIComponent(session.id)}/cancel`, 'POST', { reason: el('cancel-reason').value, version: session.version }));
            }
            if (button.dataset.action === 'attendance') {
                const roster = await request(`/api/schedules/classes/${encodeURIComponent(session.classId)}/members`);
                if (!roster.members.length) return showToast('Chưa có học viên. Hãy bổ sung danh sách lớp trước.', 'error');
                show(`Điểm danh buổi ${session.sessionNumber}`, '<p><strong>Sau khi xác nhận, buổi học sẽ bị khóa sửa và hủy.</strong></p>' + roster.members.map((u,i) => `<label>${escape(u.name)} (${escape(u.email)})<select class="form-select" id="attendance-${i}"><option value="present">Có mặt</option><option value="absent">Vắng</option><option value="late">Đi muộn</option><option value="excused">Có phép</option></select></label>`).join(''));
                el('session-action-form').onsubmit = e => commitAction(e, () => request(`/api/schedules/session/${encodeURIComponent(session.id)}/attendance`, 'POST', { version: session.version, students: roster.members.map((u,i) => ({ studentId: u.id, status: el('attendance-'+i).value })) }));
            }
        } catch (error) { showToast(error.message, 'error'); }
    };
    async function commitAction(event, fn) {
        event.preventDefault(); el('action-submit').disabled = true;
        try { const result = await fn(); close(); notify(result); await refresh(); }
        catch (error) { el('session-action-error').textContent = error.message; }
        finally { el('action-submit').disabled = false; }
    }
    el('saved-members').onclick = async () => {
        try {
            const cls = el('saved-class').value; const result = await request(`/api/schedules/classes/${encodeURIComponent(cls)}/members`);
            const selected = new Set(result.members.map(u => u.id)); const students = people.filter(p => p.type === 'student');
            show('Học viên nhận thông báo của lớp', '<p>Liên kết đúng tài khoản học viên. Danh sách ghi danh từ module cũ (nếu cùng mã lớp) vẫn được bổ sung tự động.</p>' + students.map((u,i) => `<label style="display:block;padding:8px"><input type="checkbox" id="member-${i}" ${selected.has(u.id) ? 'checked' : ''}> ${escape(u.name)} · ${escape(u.email)}</label>`).join(''));
            el('session-action-form').onsubmit = e => commitAction(e, () => request(`/api/schedules/classes/${encodeURIComponent(cls)}/members`, 'PUT', { studentIds: students.filter((_,i) => el('member-'+i).checked).map(u => u.id) }));
        } catch (error) { showToast(error.message, 'error'); }
    };
    el('saved-refresh').onclick = refreshClasses; el('saved-class').onchange = refresh;
    const originalOfficialSave = handleSaveOfficialSchedule;
    handleSaveOfficialSchedule = async () => { await originalOfficialSave(); await refreshClasses(); };
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            people = (await request('/api/schedules/people')).people;
            const list = document.createElement('datalist'); list.id = 'schedule-teachers';
            for (const p of people.filter(p => p.type === 'instructor')) { const o = document.createElement('option'); o.value = p.name; o.label = p.email; list.appendChild(o); }
            document.body.appendChild(list); el('edit-instructor').setAttribute('list', list.id);
            await refreshClasses();
        } catch (error) { el('saved-message').textContent = error.message; }
    });
})();
