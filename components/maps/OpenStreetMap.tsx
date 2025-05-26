"use client";

import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LatLngExpression } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

const OpenStreetMapContainer = ({
  position = { lat: 40.7128, lng: -74.006 },
  mapContainerStyle = { width: "100%", height: "100%", minHeight: "400px" },
  zoom = 13,
  scrollWheelZoom = false,
  mapOverlay = false,
  children,
  className,
}: {
  position?: LatLngExpression;
  mapContainerStyle?: CSSProperties;
  zoom?: number;
  scrollWheelZoom?: boolean;
  mapOverlay?: boolean;
  children?: ReactNode;
  className?: string;
}): ReactNode => {
  return (
    <div
      className={cn(
        "area-map relative isolate h-full w-full",
        mapOverlay &&
          "before:absolute before:inset-0 before:z-50 before:bg-black before:bg-opacity-15",
        className,
      )}
    >
      <MapContainer
        center={position}
        zoom={zoom}
        style={mapContainerStyle}
        scrollWheelZoom={scrollWheelZoom}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>{children}</Marker>
      </MapContainer>
    </div>
  );
};

export default OpenStreetMapContainer;
