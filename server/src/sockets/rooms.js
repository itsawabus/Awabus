// Live updates only go to the people allowed to see them: everyone signed in
// to a school (and a superadmin viewing it) sits in that school's room.
export const schoolRoom = (school) => `school:${String(school)}`;

/** Sends a live update to one school only. */
export const emitToSchool = (io, school, event, payload) => {
  if (!io || !school) return;
  io.to(schoolRoom(school)).emit(event, payload);
};
