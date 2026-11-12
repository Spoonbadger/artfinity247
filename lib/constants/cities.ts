// NYC boroughs and neighborhoods where artists hang their codes. Artfinity is open to artists anywhere in the US;
// this list is only NYC names, not a limit on who can join. Nothing imports it at the moment.
// `name` is what an artist would type as their city (citySlugFor(name, "NY") is its citySlug); `borough` groups it.
const CITY_OPTIONS = [
  { name: "Brooklyn", borough: "Brooklyn", state: "NY" },
  { name: "Williamsburg", borough: "Brooklyn", state: "NY" },
  { name: "Bushwick", borough: "Brooklyn", state: "NY" },
  { name: "Greenpoint", borough: "Brooklyn", state: "NY" },
  { name: "Bed-Stuy", borough: "Brooklyn", state: "NY" },
  { name: "DUMBO", borough: "Brooklyn", state: "NY" },
  { name: "Red Hook", borough: "Brooklyn", state: "NY" },
  { name: "Gowanus", borough: "Brooklyn", state: "NY" },
  { name: "Manhattan", borough: "Manhattan", state: "NY" },
  { name: "Lower East Side", borough: "Manhattan", state: "NY" },
  { name: "Chelsea", borough: "Manhattan", state: "NY" },
  { name: "East Village", borough: "Manhattan", state: "NY" },
  { name: "Harlem", borough: "Manhattan", state: "NY" },
  { name: "Queens", borough: "Queens", state: "NY" },
  { name: "Astoria", borough: "Queens", state: "NY" },
  { name: "Long Island City", borough: "Queens", state: "NY" },
  { name: "Bronx", borough: "Bronx", state: "NY" },
  { name: "Mott Haven", borough: "Bronx", state: "NY" },
  { name: "Staten Island", borough: "Staten Island", state: "NY" },
  { name: "St. George", borough: "Staten Island", state: "NY" },
];

export default CITY_OPTIONS;
