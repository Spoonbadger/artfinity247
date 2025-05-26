import dynamic from "next/dynamic";

const GoogleMapContainer = dynamic(() => import("./GoogleMap"), { ssr: false });

const OpenStreetMapContainer = dynamic(() => import("./OpenStreetMap"), {
  ssr: false,
});

export { GoogleMapContainer, OpenStreetMapContainer };
