export default {
	// =====================================================
	// AUTENTICACION CENTRAL - infoPCL
	// =====================================================
	/**
     * Convenciones:
     * - Metodos SIN "_" => API publica
     * - Metodos CON "_" => uso interno
     */

	// =====================================================
	// CONSTANTES DE STORE
	// =====================================================
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
	// URLS BASE
	// =====================================================
	urlIngreso: "http://" + appsmith.URL.hostname + "/app/infopcl/ingreso",
	urlMenu: "http://" + appsmith.URL.hostname + "/app/infopcl/menu",
	urlNoAutorizado: "http://" + appsmith.URL.hostname + "/app/infopcl/no-autorizado",

	// =====================================================
	// CONFIGURACION CENTRALIZADA DE PAGINAS
	// =====================================================
	/**
     * Agrega aqui todas las paginas protegidas del sistema.
     * Cada clave representa una pagina logica.
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

			// Ejemplo de pagina protegida por roles
			ADMIN_PRODUCTOS: {
				url: "http://" + appsmith.URL.hostname + "/app/infopcl/admin-productos",
				roles: ["ADMINISTRADOR", "PRODUCT_MANAGER"],
				mensajeSinPermiso: "No tienes permisos para acceder a esta pagina."
			}

			// Agregar mas paginas aqui
			// EJEMPLO:
			// USUARIOS: {
			//     url: "http://" + appsmith.URL.hostname + "/app/infopcl/usuarios",
			//     roles: ["ADMINISTRADOR"]
			// }
		};
	},

	// =====================================================
	// MODO EDIT - CONTROL GLOBAL
	// =====================================================
	_estaEnModoEdicion() {
		return appsmith.mode === "EDIT";
	},

	_ejecutarSiProduccion(fn) {
		if (this._estaEnModoEdicion()) {
			return Promise.resolve();
		}
		return Promise.resolve(fn());
	},

	_navegar(pagina, { mensaje = null, tipo = "error" } = {}) {
		return this._ejecutarSiProduccion(() => {
			if (mensaje) {
				showAlert(mensaje, tipo);
			}
			navigateTo(pagina);
		});
	},

	_navegarSilencioso(pagina) {
		return this._navegar(pagina);
	},

	// =====================================================
	// MINI STATE HELPER
	// =====================================================

	/**
     * Lee un valor del store usando una constante de VARS.
     */
	_get(nombreVariable) {
		return appsmith.store[nombreVariable];
	},

	/**
     * Escribe un valor en el store usando una constante de VARS.
     */
	_set(nombreVariable, valor) {
		return storeValue(nombreVariable, valor);
	},

	/**
     * Escribe multiples valores en el store en paralelo.
     * Recibe un objeto { clave: valor }.
     */
	_setMuchos(valores) {
		return Promise.all(
			Object.keys(valores).map((clave) => storeValue(clave, valores[clave]))
		);
	},

	/**
     * Limpia multiples valores en el store en paralelo.
     * Recibe un array de claves.
     */
	_limpiarMuchos(claves) {
		return Promise.all(claves.map((clave) => storeValue(clave, null)));
	},

	/**
     * Devuelve true solo si el usuario esta autenticado.
     */
	estaAutenticado() {
		return this._get(this.VARS.USUARIO_AUTENTICADO) === true;
	},

	/**
     * Devuelve true solo si la pagina esta autorizada para renderizar.
     */
	estaPaginaAutorizada() {
		return this._get(this.VARS.PAGINA_AUTORIZADA) === true;
	},

	// =====================================================
	// GATE VISUAL (ANTI-FLICKER)
	// =====================================================
	_reiniciarPaginaAutorizada() {
		return this._set(this.VARS.PAGINA_AUTORIZADA, false);
	},

	_marcarPaginaAutorizada() {
		return this._set(this.VARS.PAGINA_AUTORIZADA, true);
	},

	// =====================================================
	// BOOTSTRAP DE SESION (URL -> STORE)
	// =====================================================
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
	// GUARD BASE DE ACCESO
	// =====================================================
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
     * Ejemplo:
     * infoPCLAuth.protegerPagina("ADMIN_PRODUCTOS")
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
     * Ejemplo:
     * infoPCLAuth.irAPagina("MENU")
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
	tieneRol(rol) {
		const roles = this._get(this.VARS.ROLES);
		if (!roles) return false;
		return roles.includes(rol);
	},

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

	irAIngresoLimpiandoSesion(mensaje = null) {
		return this._limpiarSesion().then(() => {
			if (mensaje) {
				return this._navegar(this.urlIngreso, { mensaje });
			}
			return this._navegarSilencioso(this.urlIngreso);
		});
	},

	/**
     * Procesa el resultado del query de autenticacion en la pagina de ingreso.
     * Uso recomendado:
     * AutenticarUsuario.run().then(() => infoPCLAuth.procesarLogin(AutenticarUsuario.data, "MENU"))
     */
	procesarLogin(data, paginaDestino = "MENU") {
		const r0 = data && data[0];

		if (!r0 || r0.resultado !== "OK") {
			showAlert(r0?.resultado || "Error de autenticacion.", "error");
			return Promise.resolve(false);
		}

		return this._setSesionDesdeResponse(r0).then(() => this.irAPagina(paginaDestino));
	},

	reiniciarIngreso() {
		return this._limpiarSesion();
	}
};