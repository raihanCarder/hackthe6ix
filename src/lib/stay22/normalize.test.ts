import { describe, expect, it } from "vitest";
import { normalizeStay22Property } from "./normalize";

describe("normalizeStay22Property", () => {
  it("normalizes the nested Stay22 v2 accommodation shape", () => {
    const hotel = normalizeStay22Property(
      {
        id: "stay22-1",
        url: "https://www.stay22.com/allez/roam/example?aid=partner",
        suppliers: {
          booking: {
            id: "booking-123",
            link: "https://www.stay22.com/allez/booking/123?aid=partner",
            media: { logoSquare: "https://example.com/booking.png" },
            price: { total: 600 },
          },
          expedia: {
            id: "expedia-456",
            link: "https://www.stay22.com/allez/expedia/456?aid=partner",
            media: { logoSquare: "https://example.com/expedia.png" },
            price: { total: 540 },
          },
        },
        name: "Harbour Hotel",
        type: "Hotel",
        location: {
          address: "1 Lake St, Toronto",
          coordinates: { lat: 43.65, lng: -79.38 },
          distanceInMeters: 1250,
        },
        rating: { value: 8.9, hotelStars: 4, count: 1234 },
        capacity: { guests: 4, bedrooms: 2, beds: 3, bathrooms: 1.5 },
        policies: { instantBook: true, freeCancellation: false },
        media: { thumbnail: "https://example.com/hotel.jpg" },
      },
      { nights: 3 },
    );

    expect(hotel).toMatchObject({
      id: "stay22-1",
      name: "Harbour Hotel",
      propertyType: "hotel",
      address: "1 Lake St, Toronto",
      latitude: 43.65,
      longitude: -79.38,
      distanceKm: 1.25,
      guestRating: 8.9,
      stars: 4,
      reviewCount: 1234,
      capacity: 4,
      bedrooms: 2,
      beds: 3,
      bathrooms: 1.5,
      freeCancellation: false,
      instantBooking: true,
      supplierCount: 2,
      supplierIds: ["booking:booking-123", "expedia:expedia-456"],
      nightlyPrice: 180,
    });
    expect(hotel?.supplierLinks).toHaveLength(2);
    expect(hotel?.bookingUrl).toContain("stay22.com/allez/roam");
  });

  it("does not treat a full-stay supplier quote as nightly without nights metadata", () => {
    const hotel = normalizeStay22Property({
      id: "stay22-2",
      suppliers: {
        booking: {
          id: "42",
          link: "https://www.stay22.com/allez/booking/42",
          price: { total: 900 },
        },
      },
    });

    expect(hotel?.nightlyPrice).toBeNull();
  });

  it("keeps the existing flat mock format compatible", () => {
    const hotel = normalizeStay22Property({
      id: "mock-1",
      name: "Mock Lodge",
      lat: 45.5,
      lng: -73.5,
      guestRating: 8.2,
      capacity: 2,
      bathrooms: 1,
      supplierIds: ["supplier-1"],
      supplierLinks: ["https://example.com/book", "not-a-url"],
      supplierCount: 1,
      nightlyPrice: 150,
    });

    expect(hotel).toMatchObject({
      id: "mock-1",
      latitude: 45.5,
      longitude: -73.5,
      guestRating: 8.2,
      capacity: 2,
      bathrooms: 1,
      supplierIds: ["supplier-1"],
      supplierLinks: ["https://example.com/book"],
      nightlyPrice: 150,
    });
  });
});
