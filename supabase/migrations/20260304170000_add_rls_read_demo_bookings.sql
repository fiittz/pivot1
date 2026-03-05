ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on demo_bookings"
  ON public.demo_bookings
  FOR SELECT
  USING (true);
