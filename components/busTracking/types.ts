export type BusTrackingLocation = {
  lat: number;
  lng: number;
  updatedAt: string;
  accuracy?: number;
};

export type BusMapPanelProps = {
  location: BusTrackingLocation | null;
  offline: boolean;
};
