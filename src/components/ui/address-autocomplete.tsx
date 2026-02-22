import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { IRISH_TOWNS, formatTownDisplay, type IrishTown } from "@/lib/irishTowns";
import { cn } from "@/lib/utils";
import { useGooglePlaces } from "@/hooks/useGooglePlaces";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onTownSelect?: (town: IrishTown) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

interface GooglePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

/** Strip "County " / "Co. " prefix from county strings */
function normalizeCounty(raw: string): string {
  return raw.replace(/^(County|Co\.?)\s+/i, "");
}

/** Look up distanceFromDublin from static list; 0 if not found */
function lookupDistance(townName: string, county: string): number {
  const match = IRISH_TOWNS.find(
    (t) => t.name.toLowerCase() === townName.toLowerCase() && t.county.toLowerCase() === county.toLowerCase(),
  );
  return match?.distanceFromDublin ?? 0;
}

/** Build a display-friendly main text from a Nominatim result */
function nominatimMainText(r: NominatimResult): string {
  const a = r.address;
  const parts: string[] = [];
  if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`);
  else if (a.road) parts.push(a.road);
  else if (a.suburb) parts.push(a.suburb);
  else if (a.town || a.village) parts.push(a.town || a.village || "");
  return parts.join(", ") || r.display_name.split(",")[0];
}

/** Build secondary text (area, county) from a Nominatim result */
function nominatimSecondaryText(r: NominatimResult): string {
  const a = r.address;
  const parts: string[] = [];
  if (a.suburb && a.road) parts.push(a.suburb);
  const city = a.city || a.town || a.village || "";
  if (city) parts.push(city);
  if (a.county) parts.push(normalizeCounty(a.county));
  return parts.join(", ");
}

/** Extract the town name from a Nominatim result for onTownSelect */
function nominatimTownName(r: NominatimResult): string {
  return r.address.city || r.address.town || r.address.village || r.address.suburb || "";
}

export function AddressAutocomplete({
  value,
  onChange,
  onTownSelect,
  placeholder = "Start typing an address or town...",
  className,
  id,
  disabled,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);

  // --- Google Places state ---
  const {
    isLoaded: googleReady,
    loadError,
    getAutocompleteService,
    getSessionToken,
    resetSessionToken,
    getPlacesService,
  } = useGooglePlaces();
  const useGoogle = googleReady && !loadError;

  const [predictions, setPredictions] = useState<GooglePrediction[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attrDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // --- Nominatim fallback state ---
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ---- Google autocomplete fetch ----
  const fetchPredictions = useCallback(
    (input: string) => {
      const service = getAutocompleteService();
      if (!service || input.length < 3) {
        setPredictions([]);
        return;
      }

      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "ie" },
          types: ["address"],
          sessionToken: getSessionToken(),
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(
              results.map((r) => ({
                placeId: r.place_id,
                mainText: r.structured_formatting.main_text,
                secondaryText: r.structured_formatting.secondary_text ?? "",
                description: r.description,
              })),
            );
          } else {
            setPredictions([]);
          }
        },
      );
    },
    [getAutocompleteService, getSessionToken],
  );

  // ---- Nominatim fetch ----
  const fetchNominatim = useCallback((input: string) => {
    if (input.length < 3) {
      setNominatimResults([]);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: input,
          format: "json",
          countrycodes: "ie",
          limit: "8",
          addressdetails: "1",
        }),
      {
        signal: controller.signal,
        headers: { "User-Agent": "BalnceApp/1.0" },
      },
    )
      .then((res) => res.json())
      .then((data: NominatimResult[]) => {
        if (!controller.signal.aborted) {
          setNominatimResults(data);
          if (isFocusedRef.current && data.length > 0) {
            setOpen(true);
          } else if (data.length === 0) {
            setOpen(false);
          }
        }
      })
      .catch(() => {
        // Aborted or network error — ignore
      });
  }, []);

  // ---- Google place selection ----
  const handleGoogleSelect = useCallback(
    (prediction: GooglePrediction) => {
      onChange(prediction.description);
      setOpen(false);

      if (!onTownSelect) {
        resetSessionToken();
        return;
      }

      // Fetch full details to extract county
      const div = attrDivRef.current ?? document.createElement("div");
      attrDivRef.current = div;
      const service = getPlacesService(div);
      if (!service) {
        resetSessionToken();
        return;
      }

      service.getDetails(
        {
          placeId: prediction.placeId,
          fields: ["address_components"],
          sessionToken: getSessionToken(),
        },
        (place, detailStatus) => {
          resetSessionToken();

          if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !place?.address_components) {
            return;
          }

          let county = "";
          let townName = "";

          for (const comp of place.address_components) {
            if (comp.types.includes("administrative_area_level_1")) {
              county = normalizeCounty(comp.long_name);
            }
            if (!townName && (comp.types.includes("locality") || comp.types.includes("postal_town"))) {
              townName = comp.long_name;
            }
          }

          if (county) {
            onTownSelect({
              name: townName || prediction.mainText,
              county,
              distanceFromDublin: lookupDistance(townName || prediction.mainText, county),
            });
          }
        },
      );

      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange, onTownSelect, getPlacesService, getSessionToken, resetSessionToken],
  );

  // ---- Nominatim selection ----
  const handleNominatimSelect = useCallback(
    (result: NominatimResult) => {
      onChange(result.display_name);
      setOpen(false);

      if (onTownSelect) {
        const county = result.address.county ? normalizeCounty(result.address.county) : "";
        const town = nominatimTownName(result);
        if (county || town) {
          onTownSelect({
            name: town,
            county,
            distanceFromDublin: lookupDistance(town, county),
          });
        }
      }

      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange, onTownSelect],
  );

  // Open/close popover when Google predictions change
  useEffect(() => {
    if (useGoogle && isFocusedRef.current) {
      setOpen(predictions.length > 0);
    }
  }, [predictions, useGoogle]);

  // ---- Input change handler ----
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (useGoogle) {
      if (newValue.length >= 3) {
        debounceRef.current = setTimeout(() => fetchPredictions(newValue), 300);
      } else {
        setPredictions([]);
      }
    } else {
      // Nominatim fallback — debounce at 400ms to respect rate limits
      if (newValue.length >= 3) {
        debounceRef.current = setTimeout(() => fetchNominatim(newValue), 400);
      } else {
        setNominatimResults([]);
        setOpen(false);
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const hasResults = useGoogle ? predictions.length > 0 : nominatimResults.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            value={value}
            onChange={handleInputChange}
            onFocus={() => {
              isFocusedRef.current = true;
              if (hasResults) setOpen(true);
            }}
            onBlur={() => {
              isFocusedRef.current = false;
            }}
            placeholder={placeholder}
            className={cn(className)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      {open && (
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {useGoogle
                  ? predictions.map((pred) => (
                      <CommandItem
                        key={pred.placeId}
                        value={pred.placeId}
                        onSelect={() => handleGoogleSelect(pred)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{pred.mainText}</span>
                        <span className="ml-auto text-sm text-muted-foreground truncate">{pred.secondaryText}</span>
                      </CommandItem>
                    ))
                  : nominatimResults.map((result) => (
                      <CommandItem
                        key={result.place_id}
                        value={String(result.place_id)}
                        onSelect={() => handleNominatimSelect(result)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{nominatimMainText(result)}</span>
                        <span className="ml-auto text-sm text-muted-foreground truncate">
                          {nominatimSecondaryText(result)}
                        </span>
                      </CommandItem>
                    ))}
              </CommandGroup>
            </CommandList>
            {useGoogle && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-right border-t">Powered by Google</div>
            )}
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}
