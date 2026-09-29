# Sample bulk-upload files

Small, valid data sets for trying out a school from scratch. Upload them in
this order (each one links to the records made by the one before):

1. `1-routes.xlsx`: 5 routes (4 active, 1 inactive)
2. `2-buses.xlsx`: 4 buses, one per active route
3. `3-drivers.xlsx`: 4 drivers, one per bus
4. `4-students.xlsx`: 15 students

Every workbook has a **Scenarios** sheet saying what each row is for. The
upload only reads the first sheet.

Routes are given by name (e.g. `Madina - Adenta`) because route IDs are made
when the routes are uploaded; buses are given by plate.

What the students cover:

| Scenario | Students |
| --- | --- |
| Siblings, one parent, one home: calls on for one child only | Ama & Kofi Owusu; Akosua, Kwabena & Abena Adjei (3) |
| Siblings on different runs (morning only / evening only) | Adwoa & Kojo Ofori |
| Morning only | Efua Asante, Esi Quaye, Adwoa Ofori |
| Evening only | Selorm Agbeko, Nana Ama Mensah, Kojo Ofori |
| Both runs | everyone else |
| Parent does not want arrival calls | Yaw Boateng, Kofi Owusu, Kwabena & Abena Adjei |
| Parent languages | Twi, Ewe, Hausa, English, blank (becomes English) |
| Blank Rides / Arrival Calls (defaults) | Nii Laryea |
| Second contact, medical/care notes, 300 m zone | Yaw Boateng, Nii Laryea / Abena Adjei, Musah Ibrahim |

Also covered: a route without run times (split at noon), times typed as
`6:15 AM`, plates typed as `gt881z` / `GW 120 23` (tidied to GT-881-Z /
GW-120-23), a license typed `ghdl40517`, and a driver whose license expires
within 30 days (License Alerts).

The phone numbers (055 710 000x drivers, 026 720 0xxx parents) are made up;
change them to real phones to receive calls or messages.
