// The bus as drivers know it: its name (e.g. "Bus A"), not the plate number.
// Falls back to the plate only when a bus has no name.
export const busLabel = (bus) => bus?.name || bus?.plateNumber || '';
