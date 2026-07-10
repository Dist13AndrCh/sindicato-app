let socios = [], gestiones = [], activities = [], pagosCache = [], recibosCache = [], asistenciasCache = [];
let recaudacionesCache = [], aportesCache = [];
let currentEditingSocioId = null;
let currentReceiptData = null; 
let currentUserSocioId = null; 

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let unsubSocios = null;
let unsubGestiones = null;
let unsubActividades = null;
let unsubAvisos = null;
let unsubPagos = null;
let unsubRecibos = null;
let unsubAsistencias = null;
let unsubRecaudaciones = null;
let unsubAportes = null;