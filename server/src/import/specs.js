import { VOICE_LANGUAGES } from '../utils/languages.js';
import { RIDE_SESSION_LABELS } from '../utils/sessions.js';

// Column definitions for the bulk-upload Excel templates. The same list drives
// the downloadable template (headers, dropdowns, Excel cell rules, the
// instructions sheet) and the checks run on an uploaded file, so the two can't
// drift apart.
//
// kind:
//   text     free text (min/max length)
//   name     a person's name (letters, spaces, - ' .)
//   list     one of `options` (Excel dropdown)
//   ref      one of the school's existing records (Excel dropdown filled at download time)
//   time     a time of day, e.g. 06:00, 6:00 AM or 15:30 (stored as HH:MM, 24-hour)
//   phone    Ghana phone, 10 digits starting with 0
//   email, plate, license, gps
//   int / decimal   numbers with min/max
//   date     a calendar date; `rule` names the date check in utils/formats.js

export const CLASS_GRADES = [
  'Creche',
  'Nursery 1',
  'Nursery 2',
  'KG 1',
  'KG 2',
  'Basic 1',
  'Basic 2',
  'Basic 3',
  'Basic 4',
  'Basic 5',
  'Basic 6',
  'Basic 7',
  'Basic 8',
  'Basic 9',
];

export const SPECS = {
  routes: {
    label: 'Routes',
    singular: 'route',
    sheet: 'Routes',
    intro: 'One row per route. Route IDs (RT-001, RT-002, ...) are created automatically.',
    columns: [
      { key: 'name', header: 'Route Name', required: true, kind: 'text', min: 3, max: 80, example: 'West Legon - Ashongman', help: 'Where the route runs, e.g. start area - end area' },
      { key: 'status', header: 'Status', kind: 'list', options: ['Active', 'Inactive'], example: 'Active', help: 'Leave blank for Active' },
      // Added later: templates downloaded before these existed are still accepted.
      { key: 'morningStartTime', header: 'Morning Start Time', kind: 'time', example: '06:00', help: 'When the morning pick-up usually leaves, before 12:00, e.g. 06:00', addedLater: true },
      { key: 'eveningStartTime', header: 'Evening Start Time', kind: 'time', example: '15:00', help: 'When the afternoon drop-off usually leaves school, 12:00 or later, e.g. 15:00', addedLater: true },
    ],
  },

  buses: {
    label: 'Buses',
    singular: 'bus',
    sheet: 'Buses',
    intro: 'One row per bus. Every bus must serve a route, and a route can only have one bus.',
    columns: [
      { key: 'plateNumber', header: 'Plate Number', required: true, kind: 'plate', example: 'GR-1234-20', help: 'Region letters - number - year, e.g. GR-1234-20' },
      { key: 'name', header: 'Bus Name', required: true, kind: 'text', min: 2, max: 60, example: 'Bus A (Yellow)', help: 'A nickname staff will recognise' },
      { key: 'type', header: 'Bus Type', kind: 'list', options: ['Cruiser', 'Coaster', 'Standard', 'Mini'], example: 'Coaster', help: 'Leave blank for Standard' },
      { key: 'capacity', header: 'Capacity (Seats)', kind: 'int', min: 4, max: 100, example: 30, help: 'Optional. Whole number from 4 to 100' },
      { key: 'route', header: 'Route', required: true, kind: 'ref', ref: 'routesWithoutBus', example: 'RT-001 - West Legon - Ashongman', help: 'Pick from the list. Only routes that have no bus yet are listed' },
      { key: 'status', header: 'Status', kind: 'list', options: ['Active', 'Idle', 'Maintenance'], example: 'Idle', help: 'Leave blank for Idle' },
    ],
  },

  drivers: {
    label: 'Drivers',
    singular: 'driver',
    sheet: 'Drivers',
    intro: 'One row per driver. Every driver must be assigned a bus, and a bus can only have one driver.',
    columns: [
      { key: 'firstName', header: 'First Name', required: true, kind: 'name', example: 'Kwame' },
      { key: 'lastName', header: 'Last Name', required: true, kind: 'name', example: 'Mensah' },
      { key: 'phone', header: 'Phone Number', required: true, kind: 'phone', example: '0244123456', help: '10 digits starting with 0. Drivers sign in to the app with it' },
      { key: 'email', header: 'Email', kind: 'email', example: 'kwame.mensah@gmail.com' },
      { key: 'dob', header: 'Date of Birth', kind: 'date', rule: 'driverDob', example: '15/04/1985', help: 'DD/MM/YYYY. Drivers must be at least 18' },
      { key: 'gender', header: 'Gender', kind: 'list', options: ['Male', 'Female'], example: 'Male' },
      { key: 'licenseNumber', header: 'License Number', required: true, kind: 'license', example: 'GH-DL-29831', help: 'Capital letters and numbers as printed on the license' },
      { key: 'licenseExpiry', header: 'License Expiry Date', required: true, kind: 'date', rule: 'licenseExpiry', example: '31/12/2028', help: 'DD/MM/YYYY. Must not be expired' },
      {
        key: 'licenseClass',
        header: 'License Class',
        kind: 'list',
        options: ['Class B (Light Vehicle)', 'Class D (Articulator)', 'Class E (Motorbike)', 'Class F (Heavy Duty / Bus)'],
        example: 'Class F (Heavy Duty / Bus)',
        help: 'Leave blank for Class F (Heavy Duty / Bus)',
      },
      { key: 'bus', header: 'Assigned Bus', required: true, kind: 'ref', ref: 'busesWithoutDriver', example: 'GR-1234-20 - Bus A (Yellow)', help: 'Pick from the list. Only buses that have no driver yet are listed' },
      { key: 'emergencyContactName', required: true, header: 'Emergency Contact Name', kind: 'name', example: 'Abena Mensah' },
      { key: 'emergencyContactRelation', required: true, header: 'Emergency Contact Relation', kind: 'list', options: ['Wife', 'Husband', 'Sister', 'Brother', 'Father', 'Mother', 'Other'], example: 'Wife' },
      { key: 'emergencyContactPhone', required: true, header: 'Emergency Contact Phone', kind: 'phone', example: '0201112233' },
      { key: 'residentialAddress', header: 'Residential Address', kind: 'text', max: 120, example: 'Madina, Accra' },
    ],
  },

  students: {
    label: 'Students',
    singular: 'student',
    sheet: 'Students',
    intro:
      'One row per student. Student IDs are created automatically. Brothers and sisters can share a parent: use the same guardian phone number and the parent is saved once.',
    columns: [
      { key: 'firstName', header: 'First Name', required: true, kind: 'name', example: 'Abena' },
      { key: 'lastName', header: 'Last Name', required: true, kind: 'name', example: 'Osei' },
      { key: 'dob', header: 'Date of Birth', kind: 'date', rule: 'studentDob', example: '02/09/2016', help: 'DD/MM/YYYY' },
      { key: 'gender', header: 'Gender', kind: 'list', options: ['Female', 'Male'], example: 'Female' },
      { key: 'classGrade', header: 'Class / Grade', kind: 'list', options: CLASS_GRADES, example: 'Basic 4' },
      { key: 'route', header: 'Route', required: true, kind: 'ref', ref: 'allRoutes', example: 'RT-001 - West Legon - Ashongman', help: 'Pick from the list' },
      { key: 'guardianFirst', header: 'Guardian First Name', required: true, kind: 'name', example: 'Kofi' },
      { key: 'guardianLast', header: 'Guardian Last Name', required: true, kind: 'name', example: 'Osei' },
      { key: 'guardianRelation', header: 'Guardian Relation', kind: 'list', options: ['Father', 'Mother', 'Guardian', 'Sibling', 'Other'], example: 'Father', help: 'Leave blank for Guardian' },
      { key: 'guardianPhone', header: 'Guardian Phone', required: true, kind: 'phone', example: '0244556677', help: '10 digits starting with 0. Delay messages from the driver go to this number' },
      { key: 'guardianEmail', header: 'Guardian Email', kind: 'email', example: 'kofi.osei@gmail.com' },
      { key: 'secondContactName', header: 'Second Contact Name', kind: 'name', example: 'Mary Osei' },
      { key: 'secondContactPhone', header: 'Second Contact Phone', kind: 'phone', example: '0201112233' },
      { key: 'pickupPoint', header: 'Pickup Point', kind: 'text', max: 120, example: 'East Legon Starbites' },
      { key: 'dropoffPoint', header: 'Drop-off Point', kind: 'text', max: 120, example: 'East Legon Starbites' },
      { key: 'homeAddress', header: 'Home GPS Address', kind: 'gps', example: 'GA-543-0125', help: 'GhanaPost GPS address, e.g. GA-543-0125' },
      { key: 'lat', header: 'Home Latitude', kind: 'decimal', min: 4.5, max: 11.2, example: 5.6322, help: 'Inside Ghana: about 4.5 to 11.2' },
      { key: 'lng', header: 'Home Longitude', kind: 'decimal', min: -3.3, max: 1.3, example: -0.1581, help: 'Inside Ghana: about -3.3 to 1.3' },
      { key: 'geofenceRadius', header: 'Geofence Radius (m)', kind: 'int', min: 20, max: 1000, example: 200, help: 'Metres, 20 to 1000. Leave blank for 200' },
      { key: 'emergencyInstructions', header: 'Emergency / Medical Notes', kind: 'text', max: 300, example: 'Asthmatic - inhaler in bag' },
      // Added later: templates downloaded before it existed are still accepted (see readUpload).
      { key: 'rideSession', header: 'Rides', kind: 'list', options: Object.values(RIDE_SESSION_LABELS), example: 'Morning & evening', help: 'Which runs the student rides. Leave blank for Morning & evening', addedLater: true },
      { key: 'guardianLanguage', header: 'Guardian Language', kind: 'list', options: VOICE_LANGUAGES.map((l) => l.label), example: 'Twi', help: 'For automated calls to the parent. Leave blank for English', addedLater: true },
      { key: 'arrivalCalls', header: 'Arrival Calls', kind: 'list', options: ['Yes', 'No'], example: 'Yes', help: 'Call the parent when the bus is almost at the home. For brothers and sisters at one home, Yes for one child is enough. Leave blank for Yes', addedLater: true },
    ],
  },
};

export const ENTITIES = Object.keys(SPECS);
export const MAX_ROWS = 1000;
