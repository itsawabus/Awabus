// A bus (and the route it serves) has exactly one driver. Buses that already
// have someone else driving them are listed but can't be picked.
//
// Who drives a bus is read from the drivers list (each driver's assignedBus)
// as well as from the bus itself, so the rule holds even if one side is stale.
export function busHolders(buses = [], drivers = []) {
  const holders = new Map();
  drivers.forEach((d) => {
    const busId = d.assignedBus?._id || d.assignedBus;
    if (busId) holders.set(String(busId), { _id: d._id, name: `${d.firstName} ${d.lastName}` });
  });
  buses.forEach((b) => {
    const h = b.assignedDriver;
    if (h && typeof h === 'object' && !holders.has(String(b._id))) {
      holders.set(String(b._id), { _id: h._id, name: `${h.firstName} ${h.lastName}` });
    }
  });
  return holders;
}

/** True when a driver can be put on this bus (it has a route and no other driver). */
export const busAvailable = (holders, bus, currentDriverId = null) =>
  Boolean(bus.assignedRoute) && !busTakenBy(holders, bus._id, currentDriverId);

/** Name of the other driver already on this bus, or '' when it is free. */
export function busTakenBy(holders, busId, currentDriverId = null) {
  const h = busId ? holders.get(String(busId)) : null;
  return h && String(h._id) !== String(currentDriverId) ? h.name : '';
}

export const busPickerOptions = (buses = [], holders = new Map(), currentDriverId = null) =>
  buses.map((b) => {
    const takenBy = busTakenBy(holders, b._id, currentDriverId);
    const noRoute = !b.assignedRoute;
    return {
      value: b._id,
      label: `${b.name} (${b.plateNumber})`,
      disabled: Boolean(takenBy) || noRoute,
      description: takenBy
        ? `Already driven by ${takenBy}`
        : noRoute
          ? 'Not on a route yet. Give this bus a route first'
          : `Capacity: ${b.capacity} · no driver yet`,
    };
  });
