/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Car, Compass, Footprints, LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';

// Framing center for Tandil while Places API (New) resolves the exact Rodríguez 743 destination
const TANDIL_DEFAULT_CENTER = { lat: -37.3286, lng: -59.1367 };

interface ResolvedPlace {
  id: string;
  name: string;
  address: string;
  location: google.maps.LatLngLiteral;
}

interface AutocompleteItem {
  placeId: string;
  mainText: string;
  secondaryText: string;
  toPlace: () => google.maps.places.Place;
}

interface RouteMetrics {
  distanceText: string;
  durationText: string;
  mode: 'WALKING' | 'DRIVING';
}

function isQuotaError(err: unknown): boolean {
  const msg = String(err ?? '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError')
  );
}

function formatDistanceMeters(meters?: number): string {
  if (!meters || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationMillis(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const totalMins = Math.max(1, Math.round(ms / 60000));
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function TandilMapInner() {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [storePlace, setStorePlace] = useState<ResolvedPlace | null>(null);
  const [storeInfoOpen, setStoreInfoOpen] = useState(true);
  const [storeMarkerRef, storeMarker] = useAdvancedMarkerRef();

  const [originQuery, setOriginQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [originPlace, setOriginPlace] = useState<ResolvedPlace | null>(null);
  const [travelMode, setTravelMode] = useState<'WALKING' | 'DRIVING'>('WALKING');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [nearbyPlaces, setNearbyPlaces] = useState<ResolvedPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedNearby, setSelectedNearby] = useState<ResolvedPlace | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const searchDebounceRef = useRef<number>(0);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPolylines();
      window.clearTimeout(searchDebounceRef.current);
    };
  }, [clearPolylines]);

  // 1. Resolve Rodríguez 743, Tandil dynamically via Places API (New) — never hardcode address data
  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    async function resolveStoreDestination() {
      try {
        const PlaceClass = placesLib!.Place;
        const { places } = await PlaceClass.searchByText({
          textQuery: 'Rodríguez 743, Tandil, Provincia de Buenos Aires, Argentina',
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
          maxResultCount: 1,
        });
        if (cancelled) return;
        const first = places?.[0];
        if (first?.location) {
          const resolved: ResolvedPlace = {
            id: first.id ?? 'rodriguez-743-tandil',
            name: 'OSSK Tandil · Rodríguez 743',
            address: first.formattedAddress ?? first.displayName ?? 'Rodríguez 743, Tandil',
            location: first.location.toJSON(),
          };
          setStorePlace(resolved);
          map?.panTo(resolved.location);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    }

    resolveStoreDestination();
    return () => {
      cancelled = true;
    };
  }, [placesLib, map]);

  // 2. Modern Places API (New) AutocompleteSuggestion with session tokens
  const handleOriginInput = (value: string) => {
    setOriginQuery(value);
    setRouteError(null);
    window.clearTimeout(searchDebounceRef.current);

    if (!placesLib || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const { suggestions: raw } =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value.trim(),
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ['AR'],
            locationBias: storePlace?.location ?? TANDIL_DEFAULT_CENTER,
          });

        const parsed: AutocompleteItem[] = (raw ?? [])
          .filter((s) => Boolean(s.placePrediction))
          .slice(0, 4)
          .map((s) => {
            const pred = s.placePrediction!;
            return {
              placeId: pred.placeId,
              mainText: pred.mainText?.text ?? pred.text?.text ?? '',
              secondaryText: pred.secondaryText?.text ?? '',
              toPlace: () => pred.toPlace(),
            };
          });
        setSuggestions(parsed);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      }
    }, 240);
  };

  const handleSelectSuggestion = async (item: AutocompleteItem) => {
    soundEngine.playPop();
    setSuggestions([]);
    setOriginQuery(item.secondaryText ? `${item.mainText}, ${item.secondaryText}` : item.mainText);
    setRouteError(null);

    try {
      const place = item.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      sessionTokenRef.current = null; // End billing session after place selection
      if (place.location) {
        setOriginPlace({
          id: item.placeId,
          name: place.displayName ?? item.mainText,
          address: place.formattedAddress ?? item.secondaryText,
          location: place.location.toJSON(),
        });
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      } else {
        setRouteError('No se pudo obtener la ubicación elegida.');
      }
    }
  };

  const handleUseMyLocation = () => {
    soundEngine.playPop();
    if (!navigator.geolocation) {
      setRouteError('Tu navegador no soporta geolocalización.');
      return;
    }
    setRouteLoading(true);
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOriginPlace({
          id: 'my-location',
          name: 'Tu ubicación actual',
          address: 'GPS del dispositivo',
          location: loc,
        });
        setOriginQuery('Tu ubicación actual');
        setSuggestions([]);
        setRouteLoading(false);
      },
      () => {
        setRouteLoading(false);
        setRouteError('No se pudo leer tu ubicación. Escribí tu calle o esquina de Tandil.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  // 3. Routes API — Route.computeRoutes() + createPolylines() (zero legacy DirectionsService)
  useEffect(() => {
    if (!map || !routesLib || !originPlace || !storePlace) return;
    let cancelled = false;

    async function computeStoreRoute() {
      setRouteLoading(true);
      setRouteError(null);
      clearPolylines();

      try {
        // Modern JS SDK Routes class: developers.google.com/maps/documentation/javascript/routes?utm_campaign=gmp_mcp_codeassist_v1_aistudio
        const RouteClass = (routesLib as unknown as { Route?: { computeRoutes: (req: unknown) => Promise<{ routes?: unknown[] }> } }).Route;
        if (!RouteClass?.computeRoutes) {
          setRouteError('Librería de rutas aún inicializando.');
          setRouteLoading(false);
          return;
        }

        const { routes } = await RouteClass.computeRoutes({
          origin: originPlace!.location,
          destination: storePlace!.location,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'localizedValues'],
        });

        if (cancelled) return;
        const primary = routes?.[0] as
          | {
              distanceMeters?: number;
              durationMillis?: number;
              localizedValues?: { distance?: string; duration?: string };
              viewport?: google.maps.LatLngBounds;
              createPolylines?: (opts?: unknown) => google.maps.Polyline[];
            }
          | undefined;

        if (!primary) {
          setRouteError('No encontramos una ruta directa desde ese punto.');
          setRouteMetrics(null);
          setRouteLoading(false);
          return;
        }

        if (typeof primary.createPolylines === 'function') {
          const created = primary.createPolylines({
            polylineOptions: {
              strokeColor: '#d91e2a',
              strokeOpacity: 0.92,
              strokeWeight: 5,
            },
          });
          created.forEach((poly) => poly.setMap(map));
          polylinesRef.current = created;
        }

        if (primary.viewport) {
          map?.fitBounds(primary.viewport, 56);
        }

        setRouteMetrics({
          distanceText:
            primary.localizedValues?.distance ?? formatDistanceMeters(primary.distanceMeters),
          durationText:
            primary.localizedValues?.duration ?? formatDurationMillis(primary.durationMillis),
          mode: travelMode,
        });
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        } else {
          setRouteError('No se pudo calcular la ruta en este momento.');
        }
        setRouteMetrics(null);
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }

    computeStoreRoute();
    return () => {
      cancelled = true;
    };
  }, [map, routesLib, originPlace, storePlace, travelMode, clearPolylines]);

  // 4. Nearby Tandil spots around Rodríguez 743 strictly from Places API (New)
  const handleToggleNearby = async () => {
    soundEngine.playPop();
    if (nearbyPlaces.length > 0) {
      setNearbyPlaces([]);
      setSelectedNearby(null);
      return;
    }
    if (!placesLib) return;

    setNearbyLoading(true);
    try {
      const center = storePlace?.location ?? TANDIL_DEFAULT_CENTER;
      const { places } = await placesLib.Place.searchNearby({
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
        locationRestriction: {
          center,
          radius: 450,
        },
        includedPrimaryTypes: ['cafe', 'park', 'coffee_shop'],
        maxResultCount: 5,
      });

      const resolved: ResolvedPlace[] = (places ?? [])
        .filter((p) => Boolean(p.location))
        .map((p) => ({
          id: p.id ?? String(Math.random()),
          name: p.displayName ?? 'Spot cercano',
          address: p.formattedAddress ?? 'Centro de Tandil',
          location: p.location!.toJSON(),
        }));
      setNearbyPlaces(resolved);
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      setNearbyLoading(false);
    }
  };

  const markerCenter = storePlace?.location ?? TANDIL_DEFAULT_CENTER;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] border border-[#e4e4e4] bg-white">
      {/* Left Interactive Route & Store Control Panel */}
      <div className="p-5 md:p-6 flex flex-col justify-between gap-5 border-b lg:border-b-0 lg:border-r border-[#e4e4e4] bg-[#faf9f7]">
        <div>
          <div className="flex items-center gap-2 font-mono-tech text-[10.5px] font-bold tracking-[0.16em] uppercase text-[#d91e2a]">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Cómo llegar al local</span>
          </div>
          <h3 className="mt-2 font-display text-[32px] font-extrabold uppercase tracking-[0.02em] leading-[0.96] text-[#151413]">
            Rodríguez 743 · Tandil
          </h3>
          <p className="mt-2 text-[13.5px] text-[#5e5a54] leading-[1.55]">
            Calculá tu ruta en tiempo real hasta la puerta del showroom o explorá spots cerca para pasar antes o después de probarte.
          </p>

          {/* Origin Autocomplete Input */}
          <div className="mt-5 relative">
            <label htmlFor="tandil-origin-input" className="sr-only">
              Desde dónde salís en Tandil
            </label>
            <div className="flex items-center border border-[#c8c8c8] bg-white focus-within:border-[#151413]">
              <Search className="w-4 h-4 ml-3 text-[#66625c] shrink-0" aria-hidden="true" />
              <input
                id="tandil-origin-input"
                type="text"
                value={originQuery}
                onChange={(e) => handleOriginInput(e.target.value)}
                placeholder="Tu dirección o esquina en Tandil..."
                autoComplete="off"
                className="w-full min-h-[44px] px-2.5 bg-transparent text-[13.5px] text-[#151413] placeholder:text-[#8c877f] focus:outline-none"
              />
            </div>

            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-30 list-none m-0 p-0 bg-white border border-[#151413] shadow-lg">
                {suggestions.map((item) => (
                  <li key={item.placeId} className="border-b last:border-b-0 border-[#e4e4e4]">
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#f5f5f3] transition-colors"
                    >
                      <div className="text-[13px] font-semibold text-[#151413] truncate">
                        {item.mainText}
                      </div>
                      {item.secondaryText && (
                        <div className="text-[11px] text-[#66625c] truncate">
                          {item.secondaryText}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Geolocation + Travel Mode Switch */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 border border-[#151413] bg-white text-[#151413] font-mono-tech text-[10.5px] font-bold tracking-[0.1em] uppercase hover:bg-[#151413] hover:text-white transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Mi ubicación</span>
            </button>
            <button
              type="button"
              aria-pressed={travelMode === 'WALKING'}
              onClick={() => {
                soundEngine.playPop();
                setTravelMode('WALKING');
              }}
              aria-label="Ruta a pie"
              className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 border font-mono-tech text-[10.5px] font-bold uppercase transition-colors ${
                travelMode === 'WALKING'
                  ? 'border-[#d91e2a] bg-[#d91e2a] text-white'
                  : 'border-[#c8c8c8] bg-white text-[#5e5a54] hover:border-[#151413]'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
              <span>A pie</span>
            </button>
            <button
              type="button"
              aria-pressed={travelMode === 'DRIVING'}
              onClick={() => {
                soundEngine.playPop();
                setTravelMode('DRIVING');
              }}
              aria-label="Ruta en auto"
              className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 border font-mono-tech text-[10.5px] font-bold uppercase transition-colors ${
                travelMode === 'DRIVING'
                  ? 'border-[#d91e2a] bg-[#d91e2a] text-white'
                  : 'border-[#c8c8c8] bg-white text-[#5e5a54] hover:border-[#151413]'
              }`}
            >
              <Car className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Auto</span>
            </button>
          </div>

          {/* Live Route Readout */}
          {routeLoading && (
            <div className="mt-4 p-3 border border-[#e4e4e4] bg-white font-mono-tech text-[11px] uppercase text-[#66625c]">
              Calculando ruta hacia Rodríguez 743...
            </div>
          )}

          {routeError && (
            <div className="mt-4 p-3 border border-[#d91e2a]/40 bg-[#fff5f5] text-[12.5px] text-[#9b1c1c]">
              {routeError}
            </div>
          )}

          {routeMetrics && !routeLoading && (
            <div className="mt-4 p-3.5 border border-[#151413] bg-[#151413] text-white">
              <div className="flex items-center justify-between font-mono-tech text-[10px] tracking-[0.14em] uppercase text-[#a1a1aa]">
                <span>Ruta activa ({routeMetrics.mode === 'WALKING' ? 'A pie' : 'Auto'})</span>
                <Navigation className="w-3.5 h-3.5 text-[#ff4d58]" aria-hidden="true" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <strong className="font-display text-[30px] leading-none tracking-[0.02em]">
                  {routeMetrics.durationText}
                </strong>
                <span className="font-mono-tech text-[12px] text-[#d4d4d8]">
                  {routeMetrics.distanceText}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Nearby Spots Explorer */}
        <div className="pt-4 border-t border-[#e4e4e4]">
          <button
            type="button"
            onClick={handleToggleNearby}
            disabled={nearbyLoading}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-4 border border-[#c8c8c8] bg-white text-[#151413] font-mono-tech text-[10.5px] font-bold tracking-[0.12em] uppercase hover:border-[#151413] transition-colors disabled:opacity-60"
          >
            <Compass className="w-3.5 h-3.5 text-[#d91e2a]" aria-hidden="true" />
            <span>
              {nearbyLoading
                ? 'Buscando spots cerca...'
                : nearbyPlaces.length > 0
                  ? `Ocultar spots cercanos (${nearbyPlaces.length})`
                  : 'Ver cafés y plazas cerca del local'}
            </span>
          </button>
        </div>
      </div>

      {/* Right Interactive Google Map Container — explicit height to prevent CF2 collapse */}
      <div className="relative w-full h-[420px] md:h-[500px] bg-[#ecebe7]">
        <GoogleMap
          defaultCenter={TANDIL_DEFAULT_CENTER}
          defaultZoom={16}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          className="w-full h-full"
        >
          {/* Primary OSSK Storefront AdvancedMarker */}
          <AdvancedMarker
            ref={storeMarkerRef}
            position={markerCenter}
            title="OSSK Tandil — Rodríguez 743"
            onClick={() => setStoreInfoOpen((prev) => !prev)}
          >
            <Pin background="#d91e2a" borderColor="#151413" glyphColor="#ffffff" scale={1.15} />
          </AdvancedMarker>

          {storeInfoOpen && storeMarker && (
            <InfoWindow anchor={storeMarker} onCloseClick={() => setStoreInfoOpen(false)}>
              <div className="p-1 max-w-[210px] text-[#151413]">
                <div className="font-mono-tech text-[10px] font-bold tracking-[0.12em] uppercase text-[#d91e2a]">
                  OSSK TANDIL
                </div>
                <div className="mt-0.5 text-[13px] font-semibold">
                  {storePlace?.address ?? 'Rodríguez 743, Tandil'}
                </div>
                <div className="mt-1 text-[11px] text-[#5e5a54]">
                  Lun a Sáb · 10–13 hs y 17–20:30 hs
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Origin Marker when route is active */}
          {originPlace && (
            <AdvancedMarker position={originPlace.location} title={originPlace.name}>
              <Pin background="#151413" borderColor="#ffffff" glyphColor="#ffffff" scale={0.95} />
            </AdvancedMarker>
          )}

          {/* Dynamic Nearby Spots from Places API (New) */}
          {nearbyPlaces.map((spot) => (
            <AdvancedMarker
              key={spot.id}
              position={spot.location}
              title={spot.name}
              onClick={() => setSelectedNearby(spot)}
            >
              <Pin background="#3f3f46" borderColor="#ffffff" glyphColor="#ffffff" scale={0.85} />
            </AdvancedMarker>
          ))}

          {selectedNearby && (
            <InfoWindow
              position={selectedNearby.location}
              onCloseClick={() => setSelectedNearby(null)}
            >
              <div className="p-1 max-w-[200px] text-[#151413]">
                <div className="text-[12.5px] font-semibold">{selectedNearby.name}</div>
                <div className="mt-0.5 text-[11px] text-[#5e5a54]">{selectedNearby.address}</div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export function TandilStoreMap() {
  if (!MAPS_API_KEY) {
    return (
      <div className="border border-[#e4e4e4] bg-[#faf9f7] p-8 text-center">
        <p className="font-mono-tech text-[11px] font-bold tracking-[0.16em] uppercase text-[#151413]">
          Mapa Interactivo · Rodríguez 743, Tandil
        </p>
        <p className="mt-2 text-[13.5px] text-[#5e5a54] max-w-[460px] mx-auto">
          Configurá <code>VITE_GOOGLE_MAPS_API_KEY</code> para activar el mapa interactivo de Google Maps y el cálculo de rutas en tiempo real.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} language="es" region="AR">
      <TandilMapInner />
    </APIProvider>
  );
}
