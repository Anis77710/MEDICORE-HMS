// HealSync HMS — database seeder
// Usage: npm run seed   (connect to MONGO_URI, default mongodb://127.0.0.1:27017/healsync)
// Wipes all collections, then inserts realistic demo data + an admin account.

import { connectDb, disconnectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { UserModel } from '../models/User.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { DepartmentModel } from '../models/Department.js'
import { AppointmentModel } from '../models/Appointment.js'
import { MedicineModel, PrescriptionModel } from '../models/Pharmacy.js'
import { InvoiceModel, PaymentModel } from '../models/Billing.js'
import { StaffModel, MedicalRecordModel, DocumentModel } from '../models/Staff.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { dateTag, parseDay } from '../models/Counter.js'
import { ConsultationModel } from '../models/Consultation.js'

function today(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  return today(-n)
}

// Seeds the connected database. Wipes first, so it is only safe on
// demo/dev databases (or intentionally when re-seeding).
export async function seedData(): Promise<void> {
  // ----- Wipe everything -----
  await Promise.all([
    UserModel.deleteMany({}),
    PatientModel.deleteMany({}),
    DoctorModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    AppointmentModel.deleteMany({}),
    MedicineModel.deleteMany({}),
    PrescriptionModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    StaffModel.deleteMany({}),
    MedicalRecordModel.deleteMany({}),
    DocumentModel.deleteMany({}),
    HospitalSettingsModel.deleteMany({}),
    ConsultationModel.deleteMany({}),
  ])

  // ----- Admin -----
  await UserModel.create({
    name: 'Dr. Sarah Chen',
    email: 'admin@healsync.health',
    username: 'sarah@medicore.hms',
    phone: '+1 (555) 010-2244',
    role: 'ADMIN',
    passwordHash: 'admin123',
    lastLoginAt: new Date(),
  })
  console.log('Admin created: sarah@medicore.hms / admin123 (or admin@healsync.health / admin123)')

  await HospitalSettingsModel.create({ _id: 'hospital' })

  // ----- Doctors -----
  const doctorData = [
    { name: 'Dr. Michael Roberts', email: 'm.roberts@healsync.health', phone: '+1 (555) 010-1001', department: 'Cardiology', specialty: 'Interventional Cardiologist', qualification: 'MD, DM (Cardiology)', experienceYears: 15, consultationFee: 120, schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], patientsCount: 342, rating: 4.9 },
    { name: 'Dr. Priya Sharma', email: 'p.sharma@healsync.health', phone: '+1 (555) 010-1002', department: 'Neurology', specialty: 'Neurologist', qualification: 'MD, DM (Neurology)', experienceYears: 11, consultationFee: 110, schedule: ['Mon', 'Wed', 'Fri'], patientsCount: 218, rating: 4.8 },
    { name: 'Dr. James Osei', email: 'j.osei@healsync.health', phone: '+1 (555) 010-1003', department: 'Pediatrics', specialty: 'Pediatrician', qualification: 'MBBS, MD (Pediatrics)', experienceYears: 9, consultationFee: 90, schedule: ['Tue', 'Thu', 'Sat'], patientsCount: 296, rating: 4.7 },
    { name: 'Dr. Emily Carter', email: 'e.carter@healsync.health', phone: '+1 (555) 010-1004', department: 'General Medicine', specialty: 'Internal Medicine', qualification: 'MD (Internal Medicine)', experienceYears: 13, consultationFee: 80, schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], patientsCount: 412, rating: 4.6, status: 'On Leave' },
    { name: 'Dr. David Kim', email: 'd.kim@healsync.health', phone: '+1 (555) 010-1005', department: 'Orthopedics', specialty: 'Orthopedic Surgeon', qualification: 'MS (Orthopedics)', experienceYears: 17, consultationFee: 130, schedule: ['Mon', 'Tue', 'Fri'], patientsCount: 187, rating: 4.9 },
    { name: 'Dr. Amara Diallo', email: 'a.diallo@healsync.health', phone: '+1 (555) 010-1006', department: 'Dermatology', specialty: 'Dermatologist', qualification: 'MD (Dermatology)', experienceYears: 8, consultationFee: 85, schedule: ['Wed', 'Thu', 'Fri'], patientsCount: 154, rating: 4.5 },
    { name: 'Dr. Robert Nguyen', email: 'r.nguyen@healsync.health', phone: '+1 (555) 010-1007', department: 'Oncology', specialty: 'Medical Oncologist', qualification: 'MD, DM (Oncology)', experienceYears: 14, consultationFee: 140, schedule: ['Mon', 'Tue', 'Wed', 'Thu'], patientsCount: 129, rating: 4.8 },
    { name: 'Dr. Grace Adeyemi', email: 'g.adeyemi@healsync.health', phone: '+1 (555) 010-1008', department: 'Gynecology', specialty: 'Gynecologist', qualification: 'MS (Obstetrics & Gynecology)', experienceYears: 12, consultationFee: 100, schedule: ['Mon', 'Wed', 'Fri', 'Sat'], patientsCount: 231, rating: 4.7 },
  ]
  const doctors = await DoctorModel.insertMany(
    doctorData.map((d) => ({ ...d, status: d.status ?? 'Active' })),
  )
  console.log(`Seeded ${doctors.length} doctors`)

  // ----- Doctor portal logins: every seeded doctor gets an account -----
  // A doctor signs in here and is matched to their Doctor profile by email.
  // Username follows the firstname@medicore.hms convention.
  await UserModel.create(
    doctorData.map((d) => ({
      name: d.name,
      email: d.email,
      username: `${d.name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/)[0]!.toLowerCase()}@medicore.hms`,
      phone: d.phone,
      role: 'DOCTOR' as const,
      passwordHash: 'doctor123',
    })),
  )
  console.log('Seeded doctor accounts (username: firstname@medicore.hms, password: doctor123)')

  // ----- Departments -----
  const departments = await DepartmentModel.insertMany([
    { name: 'Cardiology', headDoctorId: doctors[0]!._id, headDoctorName: doctors[0]!.name, bedCount: 24, occupiedBeds: 19, doctorsCount: 6, patientsCount: 42, color: '#0e7490', icon: 'HeartPulse', description: 'Diagnosis and treatment of heart conditions.' },
    { name: 'Neurology', headDoctorId: doctors[1]!._id, headDoctorName: doctors[1]!.name, bedCount: 18, occupiedBeds: 11, doctorsCount: 4, patientsCount: 28, color: '#7c3aed', icon: 'Brain', description: 'Disorders of the brain and nervous system.' },
    { name: 'Pediatrics', headDoctorId: doctors[2]!._id, headDoctorName: doctors[2]!.name, bedCount: 20, occupiedBeds: 15, doctorsCount: 5, patientsCount: 56, color: '#f59e0b', icon: 'Baby', description: 'Medical care for infants, children and adolescents.' },
    { name: 'General Medicine', headDoctorId: doctors[3]!._id, headDoctorName: doctors[3]!.name, bedCount: 32, occupiedBeds: 27, doctorsCount: 8, patientsCount: 74, color: '#10b981', icon: 'Stethoscope', description: 'Adult primary care and internal medicine.' },
    { name: 'Orthopedics', headDoctorId: doctors[4]!._id, headDoctorName: doctors[4]!.name, bedCount: 16, occupiedBeds: 9, doctorsCount: 3, patientsCount: 21, color: '#ef4444', icon: 'Bone', description: 'Surgical treatment of the musculoskeletal system.' },
    { name: 'Oncology', headDoctorId: doctors[6]!._id, headDoctorName: doctors[6]!.name, bedCount: 14, occupiedBeds: 12, doctorsCount: 4, patientsCount: 19, color: '#8b5cf6', icon: 'Ribbon', description: 'Cancer diagnosis, chemotherapy and care.' },
  ])
  console.log(`Seeded ${departments.length} departments`)

  // ----- Patients -----
  const patientData = [
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@email.com', phone: '+1 (555) 020-2101', dob: '1992-04-18', gender: 'Female', bloodGroup: 'A+', address: '241 Maple Ave, Springfield', emergencyContact: '+1 (555) 020-2199', status: 'Admitted', department: 'Cardiology', admittedAt: daysAgo(5), lastVisit: daysAgo(5), allergies: ['Penicillin'], insurance: 'BlueCross HMO', notes: 'Post-surgery monitoring' },
    { firstName: 'John', lastName: 'Miller', email: 'john.miller@email.com', phone: '+1 (555) 020-2102', dob: '1965-11-02', gender: 'Male', bloodGroup: 'O-', address: '88 Cedar Road, Riverton', emergencyContact: '+1 (555) 020-2198', status: 'Critical', department: 'Oncology', admittedAt: daysAgo(7), lastVisit: daysAgo(3), allergies: ['Sulfa drugs'], insurance: 'Medicare', notes: 'Chemotherapy cycle 3' },
    { firstName: 'Aisha', lastName: 'Khan', email: 'aisha.khan@email.com', phone: '+1 (555) 020-2103', dob: '1988-02-25', gender: 'Female', bloodGroup: 'B+', address: '12 Oak Street, Westlake', emergencyContact: '+1 (555) 020-2197', status: 'Outpatient', department: 'Dermatology', lastVisit: daysAgo(4), allergies: [], insurance: 'Aetna PPO' },
    { firstName: 'Tom', lastName: 'Brennan', email: 'tom.brennan@email.com', phone: '+1 (555) 020-2104', dob: '1978-09-14', gender: 'Male', bloodGroup: 'AB+', address: '5 Pine Court, Northfield', emergencyContact: '+1 (555) 020-2196', status: 'Recovered', department: 'Orthopedics', lastVisit: daysAgo(8), allergies: ['Latex'], insurance: 'United Health' },
    { firstName: 'Maria', lastName: 'Gonzalez', email: 'maria.gonzalez@email.com', phone: '+1 (555) 020-2105', dob: '2001-07-08', gender: 'Female', bloodGroup: 'O+', address: '77 Willow Lane, Eastbrook', emergencyContact: '+1 (555) 020-2195', status: 'Outpatient', department: 'Pediatrics', lastVisit: daysAgo(3), allergies: [], insurance: 'CHIP' },
    { firstName: 'Henry', lastName: 'Okafor', email: 'henry.okafor@email.com', phone: '+1 (555) 020-2106', dob: '1959-01-30', gender: 'Male', bloodGroup: 'A-', address: '33 Birch Drive, Sunnydale', emergencyContact: '+1 (555) 020-2194', status: 'Admitted', department: 'General Medicine', admittedAt: daysAgo(2), lastVisit: daysAgo(2), allergies: ['Aspirin'], insurance: 'Medicaid' },
    { firstName: 'Lily', lastName: 'Anderson', email: 'lily.anderson@email.com', phone: '+1 (555) 020-2107', dob: '2019-12-11', gender: 'Female', bloodGroup: 'B-', address: '120 Elm Street, Fairview', emergencyContact: '+1 (555) 020-2193', status: 'Recovered', department: 'Pediatrics', lastVisit: daysAgo(11), allergies: ['Peanuts'], insurance: 'CHIP' },
    { firstName: 'George', lastName: 'Patel', email: 'george.patel@email.com', phone: '+1 (555) 020-2108', dob: '1985-06-19', gender: 'Male', bloodGroup: 'O+', address: '9 Cypress Way, Lakeside', emergencyContact: '+1 (555) 020-2192', status: 'Pending', department: 'Neurology', lastVisit: daysAgo(3), allergies: [], insurance: 'Cigna' },
    { firstName: 'Nina', lastName: 'Volkov', email: 'nina.volkov@email.com', phone: '+1 (555) 020-2109', dob: '1995-03-27', gender: 'Female', bloodGroup: 'A-', address: '214 Aspen Ave, Crestview', emergencyContact: '+1 (555) 020-2191', status: 'Outpatient', department: 'Gynecology', lastVisit: daysAgo(5), allergies: ['Dust mites'], insurance: 'BlueCross HMO' },
    { firstName: 'Samuel', lastName: 'Wright', email: 'samuel.wright@email.com', phone: '+1 (555) 020-2110', dob: '1972-10-05', gender: 'Male', bloodGroup: 'B+', address: '56 Harbor Blvd, Bayport', emergencyContact: '+1 (555) 020-2190', status: 'Admitted', department: 'Cardiology', admittedAt: daysAgo(4), lastVisit: daysAgo(4), allergies: ['Iodine'], insurance: 'United Health' },
  ]
  const patients = await PatientModel.insertMany(
    patientData.map((p, i) => ({
      ...p,
      patientId: `${p.firstName}-${dateTag(new Date(Date.now() - 2 * 86400000))}-${1000 - i}`,
      createdAt: new Date(Date.now() - 2 * 86400000),
    })),
  )
  console.log(`Seeded ${patients.length} patients`)

  // ----- Appointments -----
  const appointmentData = [
    { patientId: patients[0]!, doctorId: doctors[0]!, date: today(0), time: '09:00', type: 'Follow-up', status: 'Confirmed', reason: 'Post-surgery checkup', durationMin: 30 },
    { patientId: patients[1]!, doctorId: doctors[6]!, date: today(0), time: '09:30', type: 'Consultation', status: 'Confirmed', reason: 'Chemotherapy review', durationMin: 45 },
    { patientId: patients[4]!, doctorId: doctors[2]!, date: today(0), time: '10:00', type: 'Checkup', status: 'Confirmed', reason: 'Annual physical', durationMin: 30 },
    { patientId: patients[3]!, doctorId: doctors[4]!, date: today(0), time: '10:30', type: 'Follow-up', status: 'Pending', reason: 'Knee recovery assessment', durationMin: 30 },
    { patientId: patients[7]!, doctorId: doctors[1]!, date: today(0), time: '11:00', type: 'Consultation', status: 'Pending', reason: 'Migraine consultation', durationMin: 40 },
    { patientId: patients[5]!, doctorId: doctors[3]!, date: today(0), time: '13:00', type: 'Emergency', status: 'Confirmed', reason: 'Chest discomfort', durationMin: 60 },
    { patientId: patients[8]!, doctorId: doctors[7]!, date: today(0), time: '14:00', type: 'Checkup', status: 'Pending', reason: 'Prenatal checkup', durationMin: 30 },
    { patientId: patients[9]!, doctorId: doctors[0]!, date: today(0), time: '15:30', type: 'Procedure', status: 'Confirmed', reason: 'Angiogram', durationMin: 90 },
    { patientId: patients[2]!, doctorId: doctors[5]!, date: today(0), time: '16:00', type: 'Follow-up', status: 'Pending', reason: 'Skin condition follow-up', durationMin: 30 },
    { patientId: patients[6]!, doctorId: doctors[2]!, date: today(1), time: '09:30', type: 'Checkup', status: 'Pending', reason: 'Vaccination', durationMin: 20 },
    { patientId: patients[0]!, doctorId: doctors[0]!, date: today(-2), time: '09:00', type: 'Consultation', status: 'Completed', reason: 'Initial assessment', durationMin: 45 },
    { patientId: patients[1]!, doctorId: doctors[6]!, date: today(-4), time: '11:30', type: 'Consultation', status: 'Completed', reason: 'Oncology consult', durationMin: 60 },
    { patientId: patients[5]!, doctorId: doctors[3]!, date: today(-6), time: '10:00', type: 'Checkup', status: 'Cancelled', reason: 'Patient rescheduled', durationMin: 30 },
  ]
  await AppointmentModel.create(
    appointmentData.map((a, i) => ({
      appointmentNo: `${a.patientId.firstName}-${dateTag(parseDay(a.date))}-${1000 + i}`,
      patientId: a.patientId._id,
      patientName: `${a.patientId.firstName} ${a.patientId.lastName}`,
      doctorId: a.doctorId._id,
      doctorName: a.doctorId.name,
      department: a.doctorId.department,
      date: a.date,
      time: a.time,
      type: a.type,
      status: a.status,
      reason: a.reason,
      durationMin: a.durationMin,
      createdAt: new Date(Date.now() - 3 * 86400000),
    })),
  )
  console.log('Seeded 13 appointments')

  // ----- Medicines -----
  const medicines = await MedicineModel.insertMany([
    { name: 'Aspirin 75mg', genericName: 'Acetylsalicylic Acid', category: 'Analgesic', manufacturer: 'Bayer', price: 4.5, stock: 240, reorderLevel: 60, expiryDate: '2027-04-30', batch: 'BA-2401' },
    { name: 'Metformin 500mg', genericName: 'Metformin HCl', category: 'Antidiabetic', manufacturer: 'Merck', price: 8.2, stock: 180, reorderLevel: 50, expiryDate: '2027-06-15', batch: 'MF-5102' },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin Trihydrate', category: 'Antibiotic', manufacturer: 'GSK', price: 6.1, stock: 34, reorderLevel: 40, expiryDate: '2026-12-20', batch: 'AM-3005' },
    { name: 'Lisinopril 10mg', genericName: 'Lisinopril', category: 'Cardiovascular', manufacturer: 'Pfizer', price: 7.8, stock: 120, reorderLevel: 40, expiryDate: '2027-02-10', batch: 'LP-1208' },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Anti-inflammatory', manufacturer: 'Abbott', price: 3.9, stock: 0, reorderLevel: 80, expiryDate: '2026-11-30', batch: 'IB-8801' },
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'Cipla', price: 2.4, stock: 420, reorderLevel: 100, expiryDate: '2027-09-01', batch: 'PC-0042' },
    { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin Calcium', category: 'Cardiovascular', manufacturer: 'Novartis', price: 11.5, stock: 95, reorderLevel: 30, expiryDate: '2027-01-25', batch: 'AT-2021' },
    { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Gastrointestinal', manufacturer: 'AstraZeneca', price: 9.0, stock: 150, reorderLevel: 45, expiryDate: '2027-03-18', batch: 'OM-6510' },
    { name: 'Salbutamol Inhaler', genericName: 'Albuterol Sulfate', category: 'Respiratory', manufacturer: 'GSK', price: 14.2, stock: 28, reorderLevel: 25, expiryDate: '2027-08-12', batch: 'SB-1133' },
    { name: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', category: 'Antihistamine', manufacturer: 'Zydus', price: 3.1, stock: 200, reorderLevel: 60, expiryDate: '2027-07-05', batch: 'CT-2204' },
    { name: 'Insulin Glargine', genericName: 'Insulin Glargine', category: 'Antidiabetic', manufacturer: 'Sanofi', price: 42.0, stock: 12, reorderLevel: 20, expiryDate: '2026-10-28', batch: 'IG-7709' },
    { name: 'Diazepam 5mg', genericName: 'Diazepam', category: 'Psychiatric', manufacturer: 'Roche', price: 5.6, stock: 65, reorderLevel: 30, expiryDate: '2027-05-14', batch: 'DZ-3310' },
  ])
  console.log(`Seeded ${medicines.length} medicines`)

  // ----- Prescriptions -----
  await PrescriptionModel.create([
    { patientId: patients[0]!._id, patientName: 'Sarah Johnson', doctorId: doctors[0]!._id, doctorName: 'Dr. Michael Roberts', prescriptionNo: `Sarah-${dateTag(parseDay(daysAgo(5)))}-1000`, medicines: [{ name: 'Aspirin 75mg', dosage: '75mg', frequency: 'Once daily', durationDays: 30 }, { name: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once daily at night', durationDays: 90 }], issuedAt: daysAgo(5), status: 'Active' },
    { patientId: patients[1]!._id, patientName: 'John Miller', doctorId: doctors[6]!._id, doctorName: 'Dr. Robert Nguyen', prescriptionNo: `John-${dateTag(parseDay(daysAgo(3)))}-1001`, medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'Every 6 hours as needed', durationDays: 14 }], issuedAt: daysAgo(3), status: 'Active' },
    { patientId: patients[4]!._id, patientName: 'Maria Gonzalez', doctorId: doctors[2]!._id, doctorName: 'Dr. James Osei', prescriptionNo: `Maria-${dateTag(parseDay(daysAgo(2)))}-1002`, medicines: [{ name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'Three times daily after meals', durationDays: 7 }], issuedAt: daysAgo(2), status: 'Active' },
    { patientId: patients[2]!._id, patientName: 'Aisha Khan', doctorId: doctors[5]!._id, doctorName: 'Dr. Amara Diallo', prescriptionNo: `Aisha-${dateTag(parseDay(daysAgo(4)))}-1003`, medicines: [{ name: 'Cetirizine 10mg', dosage: '10mg', frequency: 'Once daily', durationDays: 10 }], issuedAt: daysAgo(4), status: 'Completed' },
  ])

  // ----- Consultations (doctor portal history) -----
  const sarahAppt = await AppointmentModel.findOne({
    patientId: patients[0]!._id,
    doctorId: doctors[0]!._id,
    date: today(-2),
  })
  const johnAppt = await AppointmentModel.findOne({
    patientId: patients[1]!._id,
    doctorId: doctors[6]!._id,
    date: today(-4),
  })
  const consultRx1 = await PrescriptionModel.create({
    patientId: patients[0]!._id,
    patientName: 'Sarah Johnson',
    doctorId: doctors[0]!._id,
    doctorName: 'Dr. Michael Roberts',
    prescriptionNo: `Sarah-${dateTag(parseDay(daysAgo(2)))}-1004`,
    medicines: [
      { name: 'Aspirin 75mg', dosage: '75mg', frequency: 'Once daily', durationDays: 90, instructions: 'Take with food.' },
      { name: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once daily at night', durationDays: 90, instructions: '' },
    ],
    issuedAt: daysAgo(2),
    status: 'Active',
  })
  const consultRx2 = await PrescriptionModel.create({
    patientId: patients[1]!._id,
    patientName: 'John Miller',
    doctorId: doctors[6]!._id,
    doctorName: 'Dr. Robert Nguyen',
    prescriptionNo: `John-${dateTag(parseDay(daysAgo(4)))}-1005`,
    medicines: [
      { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'Every 6 hours as needed', durationDays: 14, instructions: '' },
    ],
    issuedAt: daysAgo(4),
    status: 'Active',
  })
  await ConsultationModel.create([
    {
      consultationNo: `Sarah-${dateTag(new Date(Date.now() - 2 * 86400000))}-1000`,
      patientId: patients[0]!._id,
      patientName: 'Sarah Johnson',
      doctorId: doctors[0]!._id,
      doctorName: 'Dr. Michael Roberts',
      appointmentId: sarahAppt?._id,
      chiefComplaint: 'Mild chest discomfort on exertion, improving since discharge.',
      symptoms: 'Occasional exertional tightness, no resting symptoms.',
      vitals: { bloodPressure: '126/80', heartRate: 72, temperature: 36.6, respiratoryRate: 16, spo2: 98, weightKg: 67, heightCm: 165, bmi: 24.6 },
      examination: { general: 'Alert and comfortable', cardiovascular: 'S1 S2 normal, no murmur', respiratory: 'Clear', neurological: 'No deficits', abdominal: 'Soft', other: '' },
      diagnosis: { primary: 'Stable angina', additional: 'Post-angioplasty status', notes: 'Recovery on track.' },
      clinicalNotes: { assessment: 'Post-PCI recovery progressing well.', observations: 'Vitals stable.', reasoning: 'Continue medical therapy.', general: '' },
      treatmentPlan: { advice: 'Gradual activity resumption.', diet: 'Low-salt diet.', lifestyle: 'Daily walks, quit smoking.', instructions: 'Report any resting chest pain.' },
      prescriptionId: consultRx1._id,
      prescriptionNo: consultRx1.prescriptionNo,
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      consultationNo: `John-${dateTag(new Date(Date.now() - 4 * 86400000))}-1001`,
      patientId: patients[1]!._id,
      patientName: 'John Miller',
      doctorId: doctors[6]!._id,
      doctorName: 'Dr. Robert Nguyen',
      appointmentId: johnAppt?._id,
      chiefComplaint: 'Chemotherapy cycle review; patient reports fatigue.',
      symptoms: 'Mild fatigue, decreased appetite, no fever.',
      vitals: { bloodPressure: '118/74', heartRate: 76, temperature: 36.8, respiratoryRate: 17, spo2: 97, weightKg: 71, heightCm: 175, bmi: 23.2 },
      examination: { general: 'Pale but oriented', cardiovascular: 'Regular rhythm', respiratory: 'Clear', neurological: 'Intact', abdominal: 'Soft, mild epigastric tenderness', other: '' },
      diagnosis: { primary: 'Hodgkin lymphoma (stage II)', additional: 'Chemotherapy-related fatigue', notes: 'Continue cycle 3 with supportive care.' },
      clinicalNotes: { assessment: 'Tolerating chemotherapy with manageable side effects.', observations: 'CBC within acceptable range.', reasoning: 'Continue current protocol.', general: '' },
      treatmentPlan: { advice: 'Adequate rest between sessions.', diet: 'High-protein, small frequent meals.', lifestyle: 'Light activity as tolerated.', instructions: 'Report fever > 38°C immediately.' },
      prescriptionId: consultRx2._id,
      prescriptionNo: consultRx2.prescriptionNo,
      createdAt: new Date(Date.now() - 4 * 86400000),
      updatedAt: new Date(Date.now() - 4 * 86400000),
    },
  ])
  console.log('Seeded 2 consultations')

  // ----- Invoices & payments -----
  const invoiceData = [
    { patient: patients[0]!, description: 'Cardiology procedure & monitoring', items: [{ description: 'Angiogram', amount: 2400 }, { description: 'ICU stay (3 days)', amount: 1800 }, { description: 'Lab panel', amount: 320 }], discount: 150, dueDate: today(12), status: 'Pending' },
    { patient: patients[1]!, description: 'Oncology treatment plan', items: [{ description: 'Chemotherapy session', amount: 3200 }, { description: 'Consultation', amount: 140 }], discount: 0, dueDate: today(8), status: 'Pending' },
    { patient: patients[4]!, description: 'Pediatric consultation & vaccination', items: [{ description: 'Consultation', amount: 90 }, { description: 'Vaccination (MMR)', amount: 65 }], discount: 0, dueDate: today(20), status: 'Paid' },
    { patient: patients[3]!, description: 'Orthopedic follow-up', items: [{ description: 'Consultation', amount: 130 }, { description: 'X-ray (knee)', amount: 180 }], discount: 0, dueDate: today(-3), status: 'Overdue' },
    { patient: patients[5]!, description: 'Emergency admission', items: [{ description: 'Emergency room', amount: 850 }, { description: 'Cardiac monitoring', amount: 600 }], discount: 50, dueDate: today(5), status: 'Paid' },
  ]
  const invoices = await InvoiceModel.create(
    invoiceData.map((inv, i) => {
      const subtotal = inv.items.reduce((s, it) => s + it.amount, 0)
      const tax = Math.round(subtotal * 0.05 * 100) / 100
      const total = Math.round((subtotal - inv.discount + tax) * 100) / 100
      return {
        invoiceNo: `${inv.patient.firstName}-${dateTag(parseDay(daysAgo(i + 1)))}-${1000 + i}`,
        patientId: inv.patient._id,
        patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
        description: inv.description,
        items: inv.items,
        subtotal,
        discount: inv.discount,
        tax,
        total,
        amountPaid: inv.status === 'Paid' ? total : 0,
        status: inv.status,
        issuedAt: daysAgo(i + 1),
        dueDate: inv.dueDate,
        createdAt: new Date(Date.now() - 4 * 86400000),
      }
    }),
  )
  await PaymentModel.create([
    { invoiceId: invoices[2]!._id, amount: invoices[2]!.total, method: 'Card', reference: 'TXN-748291', paidAt: daysAgo(2) },
    { invoiceId: invoices[4]!._id, amount: invoices[4]!.total, method: 'Insurance', reference: 'TXN-813455', paidAt: daysAgo(1) },
  ])
  console.log(`Seeded ${invoices.length} invoices`)

  // ----- Staff -----
  await StaffModel.create([
    { name: 'Dr. Sarah Chen', email: 'admin@healsync.health', phone: '+1 (555) 010-2244', role: 'ADMIN', department: 'Administration', shift: 'Morning', joinedAt: '2019-03-15', salary: 145000, status: 'Active' },
    { name: 'Nurse Emma Wilson', email: 'e.wilson@healsync.health', phone: '+1 (555) 010-2245', role: 'NURSE', department: 'Cardiology', shift: 'Morning', joinedAt: '2021-06-01', salary: 72000, status: 'Active' },
    { name: 'Nurse James Park', email: 'j.park@healsync.health', phone: '+1 (555) 010-2246', role: 'NURSE', department: 'Emergency', shift: 'Night', joinedAt: '2020-11-20', salary: 68500, status: 'Active' },
    { name: 'Olivia Martinez', email: 'o.martinez@healsync.health', phone: '+1 (555) 010-2247', role: 'STAFF', department: 'Billing', shift: 'Morning', joinedAt: '2022-02-14', salary: 54000, status: 'Active' },
    { name: 'Dr. Daniel Wright', email: 'd.wright@healsync.health', phone: '+1 (555) 010-2248', role: 'DOCTOR', department: 'Cardiology', shift: 'Morning', joinedAt: '2018-08-05', salary: 168000, status: 'On Leave' },
    { name: 'Rachel Adams', email: 'r.adams@healsync.health', phone: '+1 (555) 010-2249', role: 'STAFF', department: 'Front Desk', shift: 'Rotating', joinedAt: '2023-04-10', salary: 42000, status: 'Active' },
    { name: 'Nurse Sofia Reyes', email: 's.reyes@healsync.health', phone: '+1 (555) 010-2250', role: 'NURSE', department: 'Pediatrics', shift: 'Evening', joinedAt: '2021-09-27', salary: 70000, status: 'Active' },
    { name: 'Michael Oduya', email: 'm.oduya@healsync.health', phone: '+1 (555) 010-2251', role: 'STAFF', department: 'Pharmacy', shift: 'Rotating', joinedAt: '2022-07-18', salary: 58000, status: 'Active' },
  ])
  console.log('Seeded 8 staff members')

  // ----- Medical records & documents -----
  await MedicalRecordModel.create([
    { patientId: patients[0]!._id, date: daysAgo(5), type: 'Surgery', diagnosis: 'Coronary artery blockage', doctor: 'Dr. Michael Roberts', notes: 'Angioplasty performed successfully. Patient stable.', status: 'Final' },
    { patientId: patients[0]!._id, date: daysAgo(3), type: 'Lab', diagnosis: 'Cardiac markers elevated', doctor: 'Dr. Michael Roberts', notes: 'Troponin levels returning to normal.', status: 'Final' },
    { patientId: patients[1]!._id, date: daysAgo(7), type: 'Oncology', diagnosis: 'Stage II Hodgkin lymphoma', doctor: 'Dr. Robert Nguyen', notes: 'Started chemotherapy cycle 3. Monitoring CBC weekly.', status: 'Final' },
    { patientId: patients[5]!._id, date: daysAgo(2), type: 'Admission', diagnosis: 'Pneumonia', doctor: 'Dr. Emily Carter', notes: 'Admitted for IV antibiotics and oxygen therapy.', status: 'In Progress' },
    { patientId: patients[4]!._id, date: daysAgo(3), type: 'Consultation', diagnosis: 'Seasonal allergies', doctor: 'Dr. Amara Diallo', notes: 'Prescribed antihistamines. Follow-up in 2 weeks.', status: 'Final' },
  ])
  await DocumentModel.create([
    { patientId: patients[0]!._id, name: 'Admission_Form.pdf', type: 'PDF', size: '240 KB', date: daysAgo(5), uploadedBy: 'Front Desk' },
    { patientId: patients[0]!._id, name: 'Angiogram_Report.pdf', type: 'PDF', size: '1.2 MB', date: daysAgo(4), uploadedBy: 'Dr. Michael Roberts' },
    { patientId: patients[1]!._id, name: 'Pathology_Report.pdf', type: 'PDF', size: '480 KB', date: daysAgo(6), uploadedBy: 'Lab' },
    { patientId: patients[3]!._id, name: 'Knee_Xray.jpg', type: 'Image', size: '3.4 MB', date: daysAgo(8), uploadedBy: 'Radiology' },
  ])

  console.log('\nSeed complete.')
  console.log('Login: sarah@medicore.hms / admin123')
}

async function run(): Promise<void> {
  await connectDb(env.MONGO_URI)
  console.log(`Seeding ${env.MONGO_URI} ...`)
  await seedData()
  await disconnectDb()
  process.exit(0)
}

// Only run the CLI seeder when executed directly (not when imported by dev-memory.ts).
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  run().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}
