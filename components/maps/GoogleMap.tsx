"use client";

import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const GoogleMapContainer = ({
  position = { lat: 40.7128, lng: -74.006 },
  mapStylesOptions = null,
  mapContainerStyle = { width: "100%", height: "100%", minHeight: "400px" },
  zoom = 13,
  icon,
  onLoad,
  onUnmount,
  mapOverlay = false,
  children,
  className,
}: {
  position?: google.maps.LatLng | google.maps.LatLngLiteral;
  mapStylesOptions?: google.maps.MapTypeStyle[] | null;
  mapContainerStyle?: CSSProperties;
  zoom?: number;
  icon?: string | google.maps.Icon | google.maps.Symbol;
  onLoad?: (map: any) => void | Promise<void>;
  onUnmount?: (map: any) => void | Promise<void>;
  mapOverlay?: boolean;
  children?: ReactNode;
  className?: string;
}): ReactNode => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "GOOGLE_MAPS_API_KEY",
  });

  if (loadError) {
    return (
      <div className={cn("area-map h-full w-full", className)}>
        <p>Failed to load Google Map</p>
      </div>
    );
  }

  return isLoaded ? (
    <div
      className={cn(
        "area-map relative isolate h-full w-full",
        mapOverlay &&
          "before:absolute before:inset-0 before:z-50 before:bg-black before:bg-opacity-15",
        className,
      )}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={position}
        zoom={zoom}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: false,
          styles: mapStylesOptions,
        }}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        <Marker position={position} icon={icon}>
          {children}
        </Marker>
      </GoogleMap>
    </div>
  ) : (
    <></>
  );
};

export default GoogleMapContainer;
