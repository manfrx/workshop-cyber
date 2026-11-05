-- MedClinic - Portal do Paciente (AMBIENTE DE TREINAMENTO)
-- ========================================================
--
-- Este arquivo e montado em /seed no container do MySQL. O Compose
-- substitui os marcadores __C1_FLAG__ e __C1_DB_NAME__ pelos valores de
-- C1_FLAG e C1_DB_NAME (infra/.env) antes de importar. A flag NUNCA e
-- hardcoded no repositorio.
--
-- Os ~1000 pacientes e seus exames sao gerados pelo proprio app
-- (seeder em server.js) na primeira inicializacao.
-- Schema + dados fixos do paciente de demonstração (Ana, id=1).
-- Os demais ~1000 pacientes e seus exames são gerados pelo app
-- (seeder em server.js) na primeira inicialização.

-- Garante UTF-8 na sessão de import (o cliente MySQL conecta como latin1 por
-- padrão, o que corromperia os acentos — "í" viraria "Ã­").
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS __C1_DB_NAME__ CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE __C1_DB_NAME__;

-- ---------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------
CREATE TABLE patients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  cpf        VARCHAR(14)  NOT NULL,
  birthdate  DATE,
  gender     VARCHAR(12),
  blood_type VARCHAR(4),
  phone      VARCHAR(20),
  email      VARCHAR(120),
  address    VARCHAR(160),
  insurance  VARCHAR(60),
  insurance_id VARCHAR(30)
);

-- ---------------------------------------------------------------
-- Usuários do portal (login)
-- ---------------------------------------------------------------
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50) NOT NULL UNIQUE,
  password   VARCHAR(100) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'patient',
  patient_id INT,
  fullname   VARCHAR(100) NOT NULL
);

-- ---------------------------------------------------------------
-- Exames (muitos por paciente)
-- ---------------------------------------------------------------
CREATE TABLE exams (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  exam_date  DATE,
  category   VARCHAR(40),
  name       VARCHAR(80),
  result     VARCHAR(120),
  reference  VARCHAR(80),
  status     VARCHAR(20),
  doctor     VARCHAR(80)
);
CREATE INDEX idx_exams_patient ON exams(patient_id);

-- ---------------------------------------------------------------
-- Consultas
-- ---------------------------------------------------------------
CREATE TABLE appointments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appt_date  DATETIME,
  specialty  VARCHAR(60),
  doctor     VARCHAR(80),
  status     VARCHAR(20),
  notes      VARCHAR(160)
);

-- ---------------------------------------------------------------
-- Receitas / Prescrições
-- ---------------------------------------------------------------
CREATE TABLE prescriptions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT NOT NULL,
  rx_date     DATE,
  medication  VARCHAR(80),
  dosage      VARCHAR(60),
  instructions VARCHAR(160),
  doctor      VARCHAR(80)
);

-- ---------------------------------------------------------------
-- Tabela "secreta": só acessível via exploração (UNION-based)
-- ---------------------------------------------------------------
CREATE TABLE secrets (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  flag VARCHAR(100)
);
INSERT INTO secrets (name, flag) VALUES
  ('workshop_flag', '__C1_FLAG__');

-- ===============================================================
-- PACIENTE DE DEMONSTRAÇÃO (id = 1) — "Ana", a conta 'user'
-- ===============================================================
INSERT INTO patients
  (id, name, cpf, birthdate, gender, blood_type, phone, email, address, insurance, insurance_id)
VALUES
  (1, 'Ana Beatriz Souza', '472.118.936-55', '1991-04-17', 'Feminino', 'O+',
   '(11) 98821-4477', 'ana.souza@email.com', 'Rua das Acácias, 128 - São Paulo/SP',
   'SaúdePlena', 'SP-0098421-7');

INSERT INTO users (username, password, role, patient_id, fullname) VALUES
  ('user',  'user123',          'patient', 1,    'Ana Beatriz Souza'),
  ('admin', 'S3nh4Admin!2024',  'admin',   NULL, 'Dra. Helena Martins');

-- Exames da Ana (tela cheia)
INSERT INTO exams (patient_id, exam_date, category, name, result, reference, status, doctor) VALUES
  (1, '2026-10-12', 'Hematologia',  'Hemograma completo',        'Hemácias 4,7 mi/mm³', '4,3–5,7 mi/mm³',  'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-10-12', 'Bioquímica',   'Glicemia de jejum',         '94 mg/dL',            '70–99 mg/dL',     'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-10-12', 'Bioquímica',   'Colesterol total',          '188 mg/dL',           '< 200 mg/dL',     'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-10-12', 'Bioquímica',   'HDL',                       '58 mg/dL',            '> 40 mg/dL',      'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-10-12', 'Bioquímica',   'Triglicerídeos',            '121 mg/dL',           '< 150 mg/dL',     'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-10-12', 'Endocrino',    'TSH',                       '2,3 µUI/mL',          '0,4–4,0 µUI/mL',  'Concluído', 'Dra. Renata Dias'),
  (1, '2026-10-12', 'Endocrino',    'T4 livre',                  '1,1 ng/dL',           '0,7–1,8 ng/dL',   'Concluído', 'Dra. Renata Dias'),
  (1, '2026-09-28', 'Bioquímica',   'Creatinina',                '0,8 mg/dL',           '0,6–1,2 mg/dL',   'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-09-28', 'Hepático',     'TGO (AST)',                 '24 U/L',              '< 40 U/L',        'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-09-28', 'Hepático',     'TGP (ALT)',                 '21 U/L',              '< 41 U/L',        'Concluído', 'Dr. Marcelo Antunes'),
  (1, '2026-09-15', 'Vitaminas',    'Vitamina D (25-OH)',        '32 ng/mL',            '30–100 ng/mL',    'Concluído', 'Dra. Renata Dias'),
  (1, '2026-09-15', 'Hematologia',  'Ferritina',                 '48 ng/mL',            '15–150 ng/mL',    'Concluído', 'Dra. Renata Dias'),
  (1, '2026-08-30', 'Imagem',       'Ultrassom abdominal total', 'Sem alterações',      'Laudo em anexo',  'Concluído', 'Dr. Paulo Nakamura'),
  (1, '2026-08-30', 'Cardiologia',  'Eletrocardiograma',         'Ritmo sinusal normal','Laudo em anexo',  'Concluído', 'Dra. Camila Ferraz'),
  (1, '2026-10-20', 'Imagem',       'Raio-X de tórax',           'Aguardando laudo',    '—',               'Em análise','Dr. Paulo Nakamura');

-- Consultas da Ana
INSERT INTO appointments (patient_id, appt_date, specialty, doctor, status, notes) VALUES
  (1, '2026-11-10 09:30:00', 'Clínica Geral',  'Dr. Marcelo Antunes', 'Agendada',  'Revisão de exames de rotina'),
  (1, '2026-11-24 14:00:00', 'Endocrinologia', 'Dra. Renata Dias',    'Agendada',  'Acompanhamento tireoide'),
  (1, '2026-10-12 08:00:00', 'Clínica Geral',  'Dr. Marcelo Antunes', 'Realizada', 'Solicitação de exames');

-- Receitas da Ana
INSERT INTO prescriptions (patient_id, rx_date, medication, dosage, instructions, doctor) VALUES
  (1, '2026-10-12', 'Vitamina D3',       '2.000 UI', '1 cápsula ao dia, após o almoço',        'Dra. Renata Dias'),
  (1, '2026-10-12', 'Ômega 3',           '1.000 mg', '1 cápsula ao dia',                        'Dr. Marcelo Antunes'),
  (1, '2026-09-28', 'Dipirona',          '500 mg',   'Se dor ou febre, até 4x ao dia',          'Dr. Marcelo Antunes');
