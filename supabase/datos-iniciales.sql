-- Datos sacados del Instagram @vc.esteticaintegral.
-- Duraciones y horarios son un BORRADOR: confirmarlos con Victoria y editarlos desde el panel.
-- Correr UNA sola vez, después de esquema.sql.

update config set
  nombre = 'VC Estética Integral',
  whatsapp = '5493493449066',          -- ⚠ sacado de una tarjeta vieja: CONFIRMAR con Victoria
  direccion = 'Juana Azurduy 54, Sunchales',
  instagram = 'vc.esteticaintegral'
where id = 1;

insert into profesionales (nombre, rol, color, orden) values
  ('Victoria Cravero', 'Cosmiatra · MP 0428/01', '#8a4d5c', 1),
  ('Nail Enchantment', 'Manos y pies',           '#6b7f5e', 2),
  ('Jesi Bertone',     'Lic. en Nutrición',      '#5b6f8a', 3);

insert into servicios (nombre, categoria, descripcion, duracion_min, profesional_id, orden)
select v.nombre, v.categoria, v.descripcion, v.duracion, p.id, v.orden
from (values
  ('Limpieza facial profunda',      'Facial',     'Higiene, extracción e hidratación según tu tipo de piel.', 60, 'Victoria Cravero', 1),
  ('Dermapen / microneedling',      'Facial',     'Estimula colágeno: textura, poros y marcas.',             60, 'Victoria Cravero', 2),
  ('Plasma',                        'Facial',     'Tratamiento regenerativo para la piel.',                  60, 'Victoria Cravero', 3),
  ('Botox',                         'Facial',     'Consulta y aplicación.',                                  45, 'Victoria Cravero', 4),
  ('Labios',                        'Facial',     'Hidratación y volumen de labios.',                        45, 'Victoria Cravero', 5),
  ('Crio + HIFU',                   'Corporal',   'Criolipólisis y ultrasonido focalizado.',                 60, 'Victoria Cravero', 6),
  ('Depilación láser',              'Corporal',   'Sesión por zona.',                                        30, 'Victoria Cravero', 7),
  ('Drenaje linfático manual',      'Corporal',   'Desinflama y mejora la circulación.',                     60, 'Victoria Cravero', 8),
  ('Maderoterapia',                 'Corporal',   'Modela y activa la circulación.',                         60, 'Victoria Cravero', 9),
  ('Masaje relajante',              'Relax',      'Para soltar tensiones.',                                  60, 'Victoria Cravero', 10),
  ('Esculpidas / Dual System',      'Manos y pies','Uñas esculpidas o sistema dual.',                        120, 'Nail Enchantment', 11),
  ('Semipermanente',                'Manos y pies','Esmaltado semipermanente.',                               60, 'Nail Enchantment', 12),
  ('Pedicuría',                     'Manos y pies','Cuidado completo de pies.',                               60, 'Nail Enchantment', 13),
  ('Consulta nutricional',          'Nutrición',  'Nutrición aplicada al deporte y la salud.',               45, 'Jesi Bertone', 14)
) as v(nombre, categoria, descripcion, duracion, prof, orden)
join profesionales p on p.nombre = v.prof;

-- Horario borrador: lunes a viernes 8-12 y 15-20, sábados 8-12, para las tres.
insert into horarios (profesional_id, dia, desde, hasta)
select p.id, d.dia, f.desde::time, f.hasta::time
from profesionales p
cross join (values (1),(2),(3),(4),(5)) as d(dia)
cross join (values ('08:00','12:00'), ('15:00','20:00')) as f(desde, hasta);

insert into horarios (profesional_id, dia, desde, hasta)
select p.id, 6, '08:00', '12:00' from profesionales p;
