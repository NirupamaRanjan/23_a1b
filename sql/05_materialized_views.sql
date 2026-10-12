-- Month buckets are computed in UTC so the view does not change with the session time zone.
CREATE MATERIALIZED VIEW mv_clinic_monthly_discharges AS
SELECT
    c.id AS clinic_id,
    c.name AS clinic_name,
    DATE_TRUNC('month', a.created_at AT TIME ZONE 'UTC') AS month_year,
    COUNT(a.id) AS total_discharges
FROM clinics c
JOIN appointments a ON c.id = a.clinic_id
WHERE a.status = 'DISCHARGED'
GROUP BY c.id, c.name, DATE_TRUNC('month', a.created_at AT TIME ZONE 'UTC');

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX idx_mv_clinic_monthly ON mv_clinic_monthly_discharges (clinic_id, month_year);

-- Assignment requirement: a function that refreshes the view CONCURRENTLY.
CREATE OR REPLACE FUNCTION refresh_clinic_monthly_discharges()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clinic_monthly_discharges;
END;
$$;
