export default {
	// =====================================================
	// AUTENTICACION CENTRAL - infoPCL
	// =====================================================
	/**
     * Convenciones del modulo:
     * - Metodos SIN "_" => API publica
     * - Metodos CON "_" => uso interno del framework
     *
     * Objetivos del modulo:
     * - Centralizar autenticacion y validacion de sesion
     * - Controlar acceso por roles
     * - Evitar inconsistencias visuales en paginas protegidas
     * - Proveer una API reutilizable para todas las apps de infoPCL
     */

	// =====================================================
	// CONSTANTES DE STORE
	// =====================================================
	/**
     * Claves centralizadas del appsmith.store.
     * Usar estas constantes evita typos y facilita mantenimiento.
     */
	VARS: {
		SESION_ID: "sesion_id",
		USUARIO_ID: "usuario_id",
		NOMBRE_USUARIO: "nombre_usuario",
		CORREO_ELECTRONICO: "correo_electronico",
		ROLES: "roles",
		USUARIO_AUTENTICADO: "usuario_autenticado",
		PAGINA_AUTORIZADA: "pagina_autorizada"
	},

	// =====================================================
	// URLS BASE DEL SISTEMA
	// =====================================================
	/**
     * URLs principales del sistema.
     * Se construyen dinamicamente con el hostname actual.
     */
	urlIngreso: "http://" + appsmith.URL.hostname + "/app/infopcl/ingreso",
	urlMenu: "http://" + appsmith.URL.hostname + "/app/infopcl/menu",
	urlNoAutorizado: "http://" + appsmith.URL.hostname + "/app/infopcl/no-autorizado",

	// =====================================================
	// CONFIGURACION CENTRALIZADA DE PAGINAS
	// =====================================================
	/**
     * Devuelve el mapa centralizado de paginas del sistema.
     *
     * Cada entrada puede definir:
     * - url: direccion de la pagina
     * - roles: array de roles requeridos o null si no requiere roles
     * - mensajeSinPermiso: mensaje personalizado al denegar acceso
     *
     * Recomendacion:
     * - Agregar aqui cada pagina protegida para evitar repetir logica
     *   en los eventos onLoad.
     */
	_obtenerPaginas() {
		return {
			INGRESO: {
				url: this.urlIngreso,
				roles: null
			},
			MENU: {
				url: this.urlMenu,
				roles: null
			},
			NO_AUTORIZADO: {
				url: this.urlNoAutorizado,
				roles: null
			},
			ADMIN_PRODUCTOS: {
				url: "http://" + appsmith.URL.hostname + "/app/infopcl/admin-productos",
				roles: ["ADMINISTRADOR", "PRODUCT_MANAGER"],
				mensajeSinPermiso: "No tienes permisos para acceder a esta pagina."
			}
		};
	},

	// =====================================================
	// MODO EDIT - CONTROL GLOBAL
	// =====================================================
	/**
     * Indica si AppSmith esta en modo edicion.
     *
     * Importancia:
     * - En modo edicion NO se debe navegar automaticamente
     * - Esto evita que AppSmith redirija al login mientras se edita
     */
	_estaEnModoEdicion() {
		return appsmith.mode === "EDIT";
	},

	/**
     * Ejecuta una funcion solo si la app NO esta en modo edicion.
     *
     * Uso:
     * - Navegacion
     * - Side effects que no deben dispararse al editar
     */
	_ejecutarSiProduccion(fn) {
		if (this._estaEnModoEdicion()) {
			return Promise.resolve();
		}
		return Promise.resolve(fn());
	},

	/**
     * Navegacion controlada y segura.
     *
     * Comportamiento:
     * - No navega en modo edicion
     * - Puede mostrar un mensaje opcional antes de navegar
     *
     * Parametros:
     * - pagina: URL destino
     * - mensaje: texto opcional a mostrar
     * - tipo: tipo de alert, por defecto "error"
     */
	_navegar(pagina, { mensaje = null, tipo = "error" } = {}) {
		return this._ejecutarSiProduccion(() => {
			if (mensaje) {
				showAlert(mensaje, tipo);
			}
			navigateTo(pagina);
		});
	},

	/**
     * Navegacion sin alertas.
     *
     * Uso tipico:
     * - Redireccion por sesion vacia
     * - Redireccion al menu
     * - Redireccion al login sin mostrar errores
     */
	_navegarSilencioso(pagina) {
		return this._navegar(pagina);
	},

	// =====================================================
	// MINI STATE HELPER
	// =====================================================
	/**
     * Lee un valor del store.
     *
     * Parametros:
     * - nombreVariable: clave del store
     */
	_get(nombreVariable) {
		return appsmith.store[nombreVariable];
	},

	/**
     * Escribe un valor individual en el store.
     *
     * Parametros:
     * - nombreVariable: clave del store
     * - valor: valor a guardar
     */
	_set(nombreVariable, valor) {
		return storeValue(nombreVariable, valor);
	},

	/**
     * Escribe multiples valores en el store en paralelo.
     *
     * Parametros:
     * - valores: objeto con formato { clave: valor }
     *
     * Ejemplo:
     * this._setMuchos({
     *   [this.VARS.SESION_ID]: "abc123",
     *   [this.VARS.USUARIO_AUTENTICADO]: true
     * })
     */
	_setMuchos(valores) {
		return Promise.all(
			Object.keys(valores).map((clave) => storeValue(clave, valores[clave]))
		);
	},

	/**
     * Limpia multiples valores del store asignando null.
     *
     * Parametros:
     * - claves: array de claves a limpiar
     *
     * Nota:
     * - Actualmente no se usa de forma intensiva porque _limpiarSesion
     *   necesita algunos booleanos explicitos en false.
     */
	_limpiarMuchos(claves) {
		return Promise.all(
			claves.map((clave) => storeValue(clave, null))
		);
	},

	// =====================================================
	// HELPERS PUBLICOS DE ESTADO UI
	// =====================================================
	/**
     * Indica si hay un usuario autenticado.
     *
     * Uso recomendado:
     * - Visible de widgets del header para usuario logueado
     */
	estaAutenticado() {
		return this._get(this.VARS.USUARIO_AUTENTICADO) === true;
	},

	/**
     * Indica si la pagina actual ya fue autorizada para renderizar contenido.
     *
     * Uso recomendado:
     * - Visible del body principal en paginas protegidas
     */
	estaPaginaAutorizada() {
		return this._get(this.VARS.PAGINA_AUTORIZADA) === true;
	},

	// =====================================================
	// GATE VISUAL (ANTI-FLICKER)
	// =====================================================
	/**
     * Reinicia el estado de autorizacion visual de la pagina.
     *
     * Uso:
     * - Debe ejecutarse antes de comenzar a validar acceso
     *
     * Efecto:
     * - Oculta el contenido protegido hasta completar validacion
     */
	_reiniciarPaginaAutorizada() {
		return this._set(this.VARS.PAGINA_AUTORIZADA, false);
	},

	/**
     * Marca la pagina como autorizada para renderizar contenido.
     *
     * Uso:
     * - Solo debe llamarse cuando la validacion fue exitosa
     */
	_marcarPaginaAutorizada() {
		return this._set(this.VARS.PAGINA_AUTORIZADA, true);
	},

	// =====================================================
	// BOOTSTRAP DE SESION (URL -> STORE)
	// =====================================================
	/**
     * Inicializa la sesion leyendo sesion_id desde la URL.
     *
     * Uso:
     * - Permite SSO interno o navegacion entre apps usando sesion_id
     *
     * Comportamiento:
     * - Si la URL no trae sesion_id, no hace cambios
     * - Si ya existe sesion_id en store, no sobrescribe
     * - Si encuentra sesion_id y el store esta vacio, lo guarda
     */
	_inicializarSesionDesdeURL() {
		const sesionURL = appsmith.URL?.queryParams?.sesion_id;

		if (!sesionURL) {
			return Promise.resolve(false);
		}

		if (this._get(this.VARS.SESION_ID)) {
			return Promise.resolve(true);
		}

		return this._set(this.VARS.SESION_ID, sesionURL).then(() => true);
	},

	// =====================================================
	// MANEJO DE SESION
	// =====================================================
	/**
     * Guarda en el store la informacion de sesion devuelta por backend.
     *
     * Responsabilidades:
     * - Guardar identificadores y datos del usuario
     * - Normalizar roles a array
     * - Marcar usuario como autenticado
     *
     * Retorna:
     * - Promise que resuelve con el array normalizado de roles
     */
	_setSesionDesdeResponse(r0) {
		const rolesArr = (r0.roles || "")
		.split(",")
		.map((r) => r.trim())
		.filter(Boolean);

		return this._setMuchos({
			[this.VARS.SESION_ID]: r0.sesion_id,
			[this.VARS.USUARIO_ID]: r0.usuario_id,
			[this.VARS.NOMBRE_USUARIO]: r0.nombre_usuario,
			[this.VARS.CORREO_ELECTRONICO]: r0.correo_electronico,
			[this.VARS.ROLES]: rolesArr,
			[this.VARS.USUARIO_AUTENTICADO]: true
		}).then(() => rolesArr);
	},

	/**
     * Limpia completamente la sesion actual.
     *
     * Responsabilidades:
     * - Eliminar datos del usuario
     * - Eliminar roles
     * - Marcar usuario como NO autenticado
     * - Reiniciar bandera de pagina autorizada
     *
     * Importancia:
     * - Evita datos fantasmas en header y navegacion
     */
	_limpiarSesion() {
		return this._setMuchos({
			[this.VARS.SESION_ID]: null,
			[this.VARS.USUARIO_ID]: null,
			[this.VARS.NOMBRE_USUARIO]: null,
			[this.VARS.CORREO_ELECTRONICO]: null,
			[this.VARS.ROLES]: null,
			[this.VARS.USUARIO_AUTENTICADO]: false,
			[this.VARS.PAGINA_AUTORIZADA]: false
		});
	},

	// =====================================================
	// VALIDACION DE SESION (BACKEND)
	// =====================================================
	/**
     * Valida la sesion contra el backend y refresca el store si es valido.
     *
     * Retorna un objeto con estructura:
     * - { ok: true, roles: [...] } si la sesion es valida
     * - { ok: false, sesionVacia: true } si no hay sesion_id
     * - { ok: false, sesionVacia: false, motivo: "..." } si hay error o sesion invalida
     */
	_validarYRefrescarSesion() {
		const sesionId = this._get(this.VARS.SESION_ID);

		if (!sesionId) {
			return Promise.resolve({
				ok: false,
				sesionVacia: true
			});
		}

		return ValidarSesion.run({ p_sesion_id: sesionId })
			.then((response) => {
			const r0 = response && response[0];

			if (r0 && r0.resultado === "OK") {
				return this._setSesionDesdeResponse(r0).then((rolesArr) => ({
					ok: true,
					roles: rolesArr
				}));
			}

			return {
				ok: false,
				sesionVacia: false,
				motivo: r0?.resultado || "Sesion invalida."
			};
		})
			.catch(() => ({
			ok: false,
			sesionVacia: false,
			motivo: "Error al validar la sesion."
		}));
	},

	// =====================================================
	// API PRINCIPAL - GUARD DE ACCESO
	// =====================================================
	/**
     * Protege una pagina de forma generica.
     *
     * Flujo:
     * 1. Reinicia gate visual
     * 2. Inicializa sesion desde URL si aplica
     * 3. Valida sesion con backend
     * 4. Valida roles si fueron requeridos
     * 5. Autoriza render visual o redirige
     *
     * Parametros:
     * - roles: rol o array de roles requeridos, o null si no aplica
     * - redirigirA: URL a login si no hay sesion valida
     * - paginaSinPermiso: URL destino cuando el usuario no tiene permisos
     * - mensajeSinPermiso: mensaje a mostrar si no cumple roles
     */
	protegerAcceso(config = {}) {
		const {
			roles = null,
			redirigirA = this.urlIngreso,
			paginaSinPermiso = this.urlNoAutorizado,
			mensajeSinPermiso = "No tienes permisos para acceder a esta pagina."
		} = config;

		return this._reiniciarPaginaAutorizada()
			.then(() => this._inicializarSesionDesdeURL())
			.then(() => this._validarYRefrescarSesion())
			.then((res) => {
			if (!res.ok) {
				return this.irAIngresoLimpiandoSesion(
					res.sesionVacia ? null : res.motivo
				).then(() => false);
			}

			if (!roles) {
				return this._marcarPaginaAutorizada().then(() => true);
			}

			const rolesUsuario = res.roles || [];
			const rolesRequeridos = Array.isArray(roles) ? roles : [roles];

			const tieneAcceso = rolesRequeridos.some((rol) =>
																							 rolesUsuario.includes(rol)
																							);

			if (!tieneAcceso) {
				return this._navegar(paginaSinPermiso, {
					mensaje: mensajeSinPermiso
				}).then(() => false);
			}

			return this._marcarPaginaAutorizada().then(() => true);
		});
	},

	// =====================================================
	// ROUTING CENTRALIZADO POR PAGINA
	// =====================================================
	/**
     * Protege una pagina usando su configuracion centralizada.
     *
     * Uso recomendado en onLoad:
     * {{ infoPCLAuth.protegerPagina("ADMIN_PRODUCTOS") }}
     *
     * Beneficio:
     * - Evita repetir roles y configuracion en cada pagina
     */
	protegerPagina(nombrePagina) {
		const paginas = this._obtenerPaginas();
		const pagina = paginas[nombrePagina];

		if (!pagina) {
			showAlert("La pagina '" + nombrePagina + "' no esta configurada.", "error");
			return Promise.resolve(false);
		}

		return this.protegerAcceso({
			roles: pagina.roles || null,
			redirigirA: this.urlIngreso,
			paginaSinPermiso: this.urlNoAutorizado,
			mensajeSinPermiso:
			pagina.mensajeSinPermiso || "No tienes permisos para acceder a esta pagina."
		});
	},

	/**
     * Navega a una pagina configurada centralmente.
     *
     * Uso:
     * - Navegacion por botones
     * - Redireccion despues del login
     *
     * Parametros:
     * - nombrePagina: clave definida en _obtenerPaginas()
     * - mensaje: mensaje opcional previo a navegar
     */
	irAPagina(nombrePagina, mensaje = null) {
		const paginas = this._obtenerPaginas();
		const pagina = paginas[nombrePagina];

		if (!pagina) {
			showAlert("La pagina '" + nombrePagina + "' no esta configurada.", "error");
			return Promise.resolve(false);
		}

		if (mensaje) {
			return this._navegar(pagina.url, { mensaje });
		}

		return this._navegarSilencioso(pagina.url);
	},

	// =====================================================
	// API PUBLICA - UTILIDADES
	// =====================================================
	/**
     * Verifica si el usuario actual tiene un rol especifico.
     *
     * Uso recomendado:
     * - Visible de botones del header
     * - Visible de secciones especificas por rol
     */
	tieneRol(rol) {
		const roles = this._get(this.VARS.ROLES);
		if (!roles) return false;
		return roles.includes(rol);
	},

	/**
     * Cierra la sesion de forma controlada.
     *
     * Flujo:
     * - Intenta cerrar sesion en backend
     * - Limpia sesion local aunque el backend falle
     * - Redirige a ingreso
     */
	cerrarSesion() {
		return CerrarSesion.run({
			p_sesion_id: this._get(this.VARS.SESION_ID)
		})
			.catch(() => {
			showAlert("Error al cerrar la sesion.", "error");
		})
			.then(() => this._limpiarSesion())
			.then(() => this._navegarSilencioso(this.urlIngreso));
	},

	/**
     * Limpia la sesion local y redirige a la pagina de ingreso.
     *
     * Uso:
     * - Sesion expirada
     * - Sesion invalida
     * - Logout forzado
     * - Cualquier flujo donde deba limpiarse el estado antes de ir a login
     *
     * Parametros:
     * - mensaje: mensaje opcional a mostrar antes de redirigir
     */
	irAIngresoLimpiandoSesion(mensaje = null) {
		return this._limpiarSesion().then(() => {
			if (mensaje) {
				return this._navegar(this.urlIngreso, { mensaje });
			}
			return this._navegarSilencioso(this.urlIngreso);
		});
	},

	/**
     * Inicializa la pagina de ingreso de forma segura.
     *
     * Responsabilidades:
     * - Limpia completamente el estado de sesion del usuario
     * - Elimina datos residuales que puedan afectar el header o navegacion
     * - Garantiza que el sistema arranque en estado "no autenticado"
     * - Previene inconsistencias visuales y datos fantasmas en UI
     *
     * Uso:
     * - Debe ejecutarse en el onLoad de la pagina de ingreso
     *
     * Nota:
     * - Funciona como punto de entrada limpio al sistema
     * - Reutiliza la logica centralizada de limpieza de sesion
     */
	reiniciarIngreso() {
		return this._limpiarSesion();
	},

	/**
     * Procesa el resultado del login.
     *
     * Flujo:
     * - Verifica la respuesta del backend
     * - Si es valida, inicializa la sesion en store
     * - Redirige a una pagina definida en el routing centralizado
     *
     * Parametros:
     * - data: arreglo devuelto por el query de autenticacion
     * - paginaDestino: clave de pagina definida en _obtenerPaginas()
     *
     * Uso recomendado:
     * AutenticarUsuario.run()
     *   .then(() => infoPCLAuth.procesarLogin(AutenticarUsuario.data, "MENU"))
     */
	procesarLogin(data, paginaDestino = "MENU") {
		const r0 = data && data[0];

		if (!r0 || r0.resultado !== "OK") {
			showAlert(r0?.resultado || "Error de autenticacion.", "error");
			return Promise.resolve(false);
		}

		return this._setSesionDesdeResponse(r0)
			.then(() => this.irAPagina(paginaDestino));
	}
};