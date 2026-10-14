// Test-only API contract fixtures. They are never imported by application source.
export const setupApi = async (page) => {
    const clinic = {
        id: 217,
        name: 'Lakeview Family Clinic',
        latitude: 40.748817,
        longitude: -73.98513,
        is_accepting_patients: true,
    };
    const greenfield = { ...clinic, id: 301, name: 'Greenfield Medical' };
    const patient = { id: 10482, name: 'Asha Rao', hsa_balance: '5000.00' };
    const other = { id: 10483, name: 'Rohan Mehta', hsa_balance: '2100.00' };
    const state = {
        session: {
            actor: { role: 'patient', id: patient.id, name: patient.name },
            patient: { ...patient },
            clinic,
            csrf_token: 'test-session-csrf',
            demo_mode: true,
        },
        bookFailure: '',
        refreshFailure: false,
        nursesFailure: false,
        calls: [],
        active: false,
        bookings: new Map(),
        appointments: [
            {
                id: 558190,
                patient_id: other.id,
                patient_name: other.name,
                clinic_id: 217,
                clinic_name: clinic.name,
                copay_amount: '250.00',
                status: 'WAITING',
                created_at: '2026-10-12T22:31:00Z',
                can_update_status: true,
            },
        ],
    };
    const result = (items) => ({
        items,
        total: items.length,
        pages: 1,
        page: 1,
        page_size: 5,
    });
    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace('/api/v1', '');
        const method = request.method();
        const body = method === 'GET' ? null : request.postDataJSON();
        state.calls.push({
            path,
            query: Object.fromEntries(url.searchParams),
            method,
            body,
            headers: request.headers(),
        });
        const send = (data, status = 200) =>
            route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify(data),
            });
        if (method !== 'GET' && request.headers()['x-csrf-token'] !== state.session.csrf_token)
            return send({ code: 'CSRF_FAILED' }, 403);
        if (path === '/session') return send(state.session);
        if (path === '/session/actors')
            return send(
                result([
                    { role: 'patient', id: patient.id, name: patient.name },
                    { role: 'patient', id: other.id, name: other.name },
                    { role: 'staff', id: clinic.id, name: clinic.name },
                ])
            );
        if (path === '/session/actor') {
            state.session.actor = {
                role: body.role,
                id: body.actor_id,
                name: body.role === 'staff' ? clinic.name : other.name,
            };
            if (body.role === 'patient')
                state.session.patient = {
                    ...(body.actor_id === patient.id ? patient : other),
                };
            return send(state.session);
        }
        if (path === '/clinics')
            return send(
                result(
                    [clinic, greenfield].filter(
                        (row) =>
                            !url.searchParams.get('q') ||
                            row.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())
                    )
                )
            );
        if (path.startsWith('/clinics/')) return send(path.endsWith('/301') ? greenfield : clinic);
        if (path === '/patients') return send(result([patient, other]));
        if (path.startsWith('/patients/')) return send(path.endsWith('/10483') ? other : patient);
        if (path === '/me/audit')
            return send({
                ...result([
                    {
                        id: 90417,
                        patient_id: state.session.patient.id,
                        action_type: 'DEBIT',
                        amount_changed: '500.00',
                        balance_after: state.session.patient.hsa_balance,
                        timestamp: '2026-10-12T22:31:00Z',
                    },
                ]),
                current_balance: state.session.patient.hsa_balance,
                opening_balance: '5300.00',
                has_active_appointment: state.active,
            });
        if (path === '/appointments' && method === 'POST') {
            if (state.bookFailure) return send({ code: state.bookFailure }, 409);
            const key = request.headers()['idempotency-key'];
            if (state.bookings.has(key)) return send(state.bookings.get(key));
            if (state.active) return send({ code: 'ACTIVE_VISIT_EXISTS' }, 409);
            const before = state.session.patient.hsa_balance;
            const after = (Number(before) - Number(body.copay_amount)).toFixed(2);
            state.session.patient.hsa_balance = after;
            state.active = true;
            const appointment = {
                id: 558201,
                patient_id: state.session.patient.id,
                patient_name: state.session.patient.name,
                clinic_id: body.clinic_id,
                clinic_name: body.clinic_id === 301 ? greenfield.name : clinic.name,
                copay_amount: body.copay_amount,
                status: 'WAITING',
                created_at: '2026-10-12T22:31:00Z',
                can_update_status: true,
            };
            state.appointments.push(appointment);
            const response = {
                appointment,
                balance_before: before,
                balance_after: after,
                audit_log: {
                    id: 90418,
                    action_type: 'DEBIT',
                    amount_changed: body.copay_amount,
                    balance_after: after,
                    timestamp: '2026-10-12T22:31:00Z',
                },
            };
            state.bookings.set(key, response);
            if (state.dropBookingResponse) {
                state.dropBookingResponse = false;
                return route.abort('failed');
            }
            return send(response, 201);
        }
        if (path === '/appointments') return send(result(state.appointments));
        if (path.endsWith('/status')) {
            const id = Number(path.split('/')[2]);
            const record = state.appointments.find((row) => row.id === id);
            record.status = body.status;
            return send(record);
        }
        if (path.startsWith('/appointments/'))
            return send(
                state.appointments.find((row) => row.id === Number(path.split('/').at(-1)))
            );
        if (path === '/analytics/revenue')
            return send({
                total_copay_revenue: '61500.00',
                items: [
                    {
                        transaction_date: '2026-10-10',
                        daily_total: '4000.00',
                        moving_avg_7d: '4000.00',
                    },
                    {
                        transaction_date: '2026-10-11',
                        daily_total: '6000.00',
                        moving_avg_7d: '5000.00',
                    },
                ],
            });
        if (path === '/analytics/ranking')
            return send(
                result([
                    {
                        clinic_id: 217,
                        clinic_name: clinic.name,
                        rank_by_revenue: 3,
                        moving_avg_7d: '5000.00',
                    },
                ])
            );
        if (path === '/analytics/monthly')
            return send({
                total_discharges: 214,
                last_refreshed_at: '2026-10-12T22:35:00Z',
            });
        if (path === '/analytics/monthly/refresh')
            return state.refreshFailure
                ? send({ code: 'DATABASE_UNAVAILABLE' }, 503)
                : send({ last_refreshed_at: '2026-10-12T22:36:00Z' });
        if (path === '/nurses/nearby')
            return state.nursesFailure
                ? send({}, 503)
                : send({
                      updated_at: '2026-10-12T22:40:10Z',
                      items: state.nurseRows || [
                          {
                              nurse_id: 42,
                              is_active: true,
                              location: {
                                  type: 'Point',
                                  coordinates: [-73.98513, 40.748817],
                              },
                              created_at: '2026-10-12T22:40:00Z',
                              dist: { calculated: 480 },
                          },
                      ],
                  });
        if (path === '/reviews/insights')
            return send({
                total_reviews: 500,
                avg_rating: 4.2,
                rating_distribution: [
                    { rating: 5, count: 250 },
                    { rating: 4, count: 150 },
                    { rating: 3, count: 65 },
                    { rating: 2, count: 20 },
                    { rating: 1, count: 15 },
                ],
                frequent_tags: [
                    { tag: 'Friendly', count: 330 },
                    { tag: 'Professional', count: 280 },
                    { tag: 'Attentive', count: 240 },
                    { tag: 'Empathetic', count: 190 },
                    { tag: 'Punctual', count: 160 },
                ],
            });
        if (path === '/catalogs/specialties')
            return send({
                items: [
                    { specialty: 'Cardiology', count: 5 },
                    { specialty: 'General Practice', count: 5 },
                ],
            });
        if (path === '/catalogs')
            return send({
                ...result([
                    {
                        id: '68ead5108b523b67289a0041',
                        specialty: 'General Practice',
                        physician: 'Dr. Dana Hayes',
                        availability_slots: [
                            { day: 'Mon', start: '09:00', end: '16:00' },
                            { day: 'Thu', start: '10:00', end: '18:00' },
                        ],
                        medication_details: {
                            name: 'Paracetamol',
                            strength: '500 mg',
                            route: 'oral',
                        },
                        extra: {
                            notes: '<img src=x onerror="window.__xss=true">',
                            reference: Array.from({ length: 12 }, (_, i) => `Reference ${i}`),
                        },
                    },
                ]),
                total: 40,
                pages: 40,
            });
        return send({ code: 'NOT_FOUND' }, 404);
    });
    return state;
};
