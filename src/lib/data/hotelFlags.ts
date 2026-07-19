import {
  countryFromCode,
  inferCountryFromText,
} from "@/lib/data/countries";

export interface HotelFlagInput {
  address?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
}

export interface HotelFlag {
  src: string;
  alt: string;
}

export function resolveHotelFlag(hotel: HotelFlagInput): HotelFlag | null {
  const explicitCode = normalizeCountryCode(hotel.countryCode);
  const explicitCountry = explicitCode ? countryFromCode(explicitCode) : null;
  const inferredCountry = explicitCode ? null : inferCountryFromText(hotel.address);
  const code = explicitCode ?? inferredCountry?.code ?? null;
  if (!code) return null;

  const name = hotel.countryName ?? explicitCountry?.name ?? inferredCountry?.name ?? code;
  return {
    src: `/flags/${code}.svg`,
    alt: `${name} flag`,
  };
}

function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}
