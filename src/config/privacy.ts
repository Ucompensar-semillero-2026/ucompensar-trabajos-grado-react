/**
 * Aviso de privacidad (Ley 1581 de 2012). Los datos del responsable salen de la política vigente de UCompensar,
 * TEC-SIN-PO-001 v00 (numeral 6.1), y el aviso tiene los 5 elementos que pide su numeral 9: responsable y contacto,
 * tratamiento y finalidad, derechos del titular, cómo ejercerlos y cómo consultar la política.
 *
 * BORRADOR: el texto debe validarlo la universidad (área de protección de datos) antes de considerarlo definitivo.
 * La versión y el enlace vigentes los manda el servidor en GET /auth/me (PRIVACY_POLICY_VERSION / _URL).
 */
export const PRIVACY_RESPONSIBLE = {
  name: 'Fundación Universitaria Compensar',
  nit: '860.506.140-6',
  address: 'Av. Calle 32 # 17-30, Bogotá D.C.',
  email: 'notificacionesjudiciales@ucompensar.edu.co',
  phone: '(601) 338 06 66',
}

/** Respaldo si todavía no llegó la respuesta del servidor (p. ej. en el login). */
export const DEFAULT_PRIVACY_POLICY_URL = 'https://ucompensar.edu.co/pdf/documentos/Tratamiento-de-datos-personales.pdf'

export const PRIVACY_PURPOSE =
  'Usamos tu nombre, tu correo institucional, tu rol y la información y los archivos de tu trabajo de grado para gestionar el proceso: propuestas, plan de trabajo, entregas, revisiones, avales, calificaciones y notificaciones.'

export const PRIVACY_RIGHTS =
  'Puedes conocer, actualizar, rectificar y suprimir tus datos, pedir prueba de esta autorización, saber qué uso se les da, revocar la autorización cuando proceda y presentar quejas ante la Superintendencia de Industria y Comercio.'
