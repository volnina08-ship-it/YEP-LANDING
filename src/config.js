// Központi beállítások – itt cseréld a linkeket, kulcsokat.
// A Supabase publishable kulcs nyilvános használatra készült (RLS védi az adatokat).
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://qelmzmzpicsdaiagitsa.supabase.co',
  supabaseKey: import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_4o9e-iKOTzc4M5yE-FT-6g_2j7KO8EF',
  table: 'quote_requests',

  // Időpontfoglaló link (pl. Calendly). Ha üres, az „Időpontot foglalok” gombok az ajánlatkérő űrlapra görgetnek.
  bookingUrl: import.meta.env.VITE_BOOKING_URL || '',

  // Kapcsolati e-mail (az űrlap hibaüzenetében és az „ajánlat” blokkban jelenik meg)
  email: import.meta.env.VITE_CONTACT_EMAIL || 'yep.content@gmail.com',

  // Külső linkek a fő weboldalra (ha üres, a link elrejtődik)
  links: {
    about: 'https://yepcontent.info/',
    projects: 'https://yepcontent.info/',
  },

  // Social linkek (ha üres, a link elrejtődik)
  socials: {
    instagram: 'https://www.instagram.com/yep_content/',
    linkedin: '',
    youtube: 'https://www.youtube.com/channel/UCh_sfBPZJJ6f6AeFlgqmPUA',
  },
};
