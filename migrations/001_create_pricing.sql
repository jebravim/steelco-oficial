CREATE TABLE public.employee_access (
  email text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_access_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE public.pricing_settings (
  setting_key text PRIMARY KEY,
  square_meter_price numeric(12, 2),
  updated_at timestamptz,
  updated_by uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  CONSTRAINT pricing_settings_positive_price CHECK (
    square_meter_price IS NULL OR (square_meter_price > 0 AND square_meter_price <= 1000000)
  )
);

INSERT INTO public.employee_access (email)
VALUES ('jebravim@gmail.com');

INSERT INTO public.pricing_settings (setting_key, square_meter_price)
VALUES ('steel_frame_m2', NULL);
