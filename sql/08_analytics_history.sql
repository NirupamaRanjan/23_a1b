-- Workflow 2: 7-day moving average of copay revenue per clinic with DENSE_RANK()
-- Historical API variant: all DISCHARGED history is available.
-- Callers apply their visible date filter AFTER the seven-calendar-day RANGE window.
-- The original assignment query is preserved separately in 06_window_analytics.sql.
WITH daily_revenue AS (
    SELECT 
        clinic_id,
        DATE(created_at AT TIME ZONE 'UTC') AS transaction_date,
        SUM(copay_amount) AS daily_total
    FROM appointments
    WHERE status = 'DISCHARGED'
    GROUP BY clinic_id, DATE(created_at AT TIME ZONE 'UTC')
),
moving_averages AS (
    SELECT 
        clinic_id,
        transaction_date,
        daily_total,
        AVG(daily_total) OVER (
            PARTITION BY clinic_id 
            ORDER BY transaction_date 
            RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
        ) AS moving_avg_7d
    FROM daily_revenue
)
SELECT 
    clinic_id,
    transaction_date,
    daily_total,
    ROUND(moving_avg_7d, 2) AS moving_avg_7d,
    DENSE_RANK() OVER (PARTITION BY transaction_date ORDER BY moving_avg_7d DESC) AS rank_by_revenue
FROM moving_averages
ORDER BY transaction_date DESC, rank_by_revenue ASC;
