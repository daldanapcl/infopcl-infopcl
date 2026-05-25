export default {
	// =====================================================
	// 🔹 AUTENTICACIÓN CENTRAL - infoPCL
	// =====================================================
	/**
     * 🔒 Convenciones:
     * - Métodos SIN "_" → API pública (uso desde páginas)
     * - Métodos CON "_" → uso interno (NO invocar directamente)
     */

	// =====================================================
	// 🔹 URLs de Páginas Principales
	// =====================================================
	urlIngreso: "http://" + appsmith.URL.hostname + "/app/infopcl/ingreso",
	urlMenu: "http://" + appsmith.URL.hostname + "/app/infopcl/menu",
	urlNoAutorizado: "http://" + appsmith.URL.hostname + "/app/infopcl/no-autorizado",

	// =====================================================
	// 🔹 MODO EDIT - CONTROL GLOBAL
	// =====================================================

	/**
     * Indica si estamos en modo edición de AppSmith.
     */
	_estaEnModoEdicion() {
		return appsmith.mode === "EDIT";
	},

	/**
     * Ejecuta una función solo en modo producción.
     */
	_ejecutarSiProduccion(fn) {
		if (this._estaEnModoEdicion()) {
			return Promise.resolve();
		}
		return Promise.resolve(fn());
	},

	/**
     * Navegación controlada:
     * - Respeta modo edición
     * - Permite mostrar mensaje opcional
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
     * Navegación sin alertas (uso típico: sesión vacía).
     */
	_navegarSilencioso(pagina) {
		return this._navegar(pagina);
	},

	// =====================================================
	// 🔹 GATE VISUAL (ANTI-FLASH)
	// =====================================================

	/**
     * Reinicia estado visual de autorización.
     * Debe ejecutarse antes de validar acceso.
     */
	_reiniciarPaginaAutorizada() {
		return storeValue("pagina_autorizada", false);
	},

	/**
     * Habilita renderizado de la página.
     */
	_marcarPaginaAutorizada() {
		return storeValue("pagina_autorizada", true);
	},

	// =====================================================
	// 🔹 BOOTSTRAP DE SESIÓN (URL → STORE)
	// =====================================================

	/**
     * Lee sesion_id desde URL (SSO interno)
     * y lo almacena en el store si aún no existe.
     */
	_inicializarSesionDesdeURL() {
		const sesionURL = appsmith.URL?.queryParams?.sesion_id;

		if (!sesionURL) {
			return Promise.resolve(false);
		}

		if (appsmith.store.sesion_id) {
			return Promise.resolve(true);
		}

		return storeValue("sesion_id", sesionURL).then(() => true);
	},

	// =====================================================
	// 🔹 MANEJO DE SESIÓN
	// =====================================================

	/**
     * Actualiza el store con la información de sesión.
     * Normaliza roles a array.
     */
	_setSesionDesdeResponse(r0) {
		const rolesArr = (r0.roles || "")
		.split(",")
		.map(r => r.trim())
		.filter(Boolean);

		return Promise.all([
			storeValue("sesion_id",           r0.sesion_id),
			storeValue("usuario_id",          r0.usuario_id),
			storeValue("nombre_usuario",      r0.nombre_usuario),
			storeValue("correo_electronico",  r0.correo_electronico),
			storeValue("roles",               rolesArr),
			storeValue("usuario_autenticado", true),
		]).then(() => rolesArr);
	},

	/**
     * Limpia completamente la sesión actual.
     */
	_limpiarSesion() {
		return Promise.all([
			storeValue("sesion_id",           null),
			storeValue("usuario_id",          null),
			storeValue("nombre_usuario",      null),
			storeValue("correo_electronico",  null),
			storeValue("roles",               null),
			storeValue("usuario_autenticado", true),
		]);
	},

	// =====================================================
	// 🔹 VALIDACIÓN DE SESIÓN (BACKEND)
	// =====================================================

	/**
     * Valida sesión contra backend.
     */
	_validarYRefrescarSesion() {
		const sesionId = appsmith.store.sesion_id;

		// Sesión vacía
		if (!sesionId) {
			return Promise.resolve({
				ok: false,
				sesionVacia: true,
			});
		}

		return ValidarSesion.run({ p_sesion_id: sesionId })
			.then((response) => {
			const r0 = response && response[0];

			if (r0 && r0.resultado === "OK") {
				return this._setSesionDesdeResponse(r0).then((rolesArr) => ({
					ok: true,
					roles: rolesArr,
				}));
			}

			return {
				ok: false,
				sesionVacia: false,
				motivo: r0?.resultado || "Sesión inválida.",
			};
		})
			.catch(() => ({
			ok: false,
			sesionVacia: false,
			motivo: "Error al validar la sesión.",
		}));
	},

	// =====================================================
	// 🔹 API PRINCIPAL - GUARD DE ACCESO
	// =====================================================

	/**
     * 🔐 Protege una página:
     * - Inicializa sesión (URL)
     * - Valida sesión backend
     * - Valida roles (RBAC)
     * - Controla redirecciones
     * - Habilita render visual
     */
	protegerAcceso(config = {}) {
		const {
			roles = null,
			redirigirA = this.urlIngreso,
			paginaSinPermiso = this.urlNoAutorizado,
			mensajeSinPermiso = "No tienes permisos para acceder a esta página.",
		} = config;

		return this._reiniciarPaginaAutorizada()
			.then(() => this._inicializarSesionDesdeURL())
			.then(() => this._validarYRefrescarSesion())
			.then((res) => {

			// ❌ Sesión inválida
			if (!res.ok) {
				return this.irAIngresoLimpiandoSesion(
					res.sesionVacia ? null : res.motivo
				).then(() => false);
			}

			// ✅ Sesión válida sin roles requeridos
			if (!roles) {
				return this._marcarPaginaAutorizada().then(() => true);
			}

			const rolesUsuario = res.roles || [];
			const rolesRequeridos = Array.isArray(roles) ? roles : [roles];

			const tieneAcceso = rolesRequeridos.some(r =>
																							 rolesUsuario.includes(r)
																							);

			// ❌ Usuario sin permisos
			if (!tieneAcceso) {
				this._navegar(paginaSinPermiso, {
					mensaje: mensajeSinPermiso
				});
				return false;
			}

			// ✅ Acceso permitido
			return this._marcarPaginaAutorizada().then(() => true);
		});
	},

	// =====================================================
	// 🔹 API PÚBLICA - UTILIDADES
	// =====================================================

	/**
     * Verifica si usuario tiene un rol específico.
     */
	tieneRol(rol) {
		const roles = appsmith.store.roles;
		if (!roles) return false;
		return roles.includes(rol);
	},

	/**
  * Cierra sesión de forma controlada.
  */
	cerrarSesion() {
		return CerrarSesion.run({ p_sesion_id: appsmith.store.sesion_id })
			.catch(() => {
			showAlert("Error al cerrar la sesión.", "error");
		})
			.then(() => this._limpiarSesion())
			.then(() => this._navegarSilencioso(this.urlIngreso));
	},

	/**
 * 🔐 Limpia la sesión y redirige a login.
 * Uso: errores de autenticación, expiración, logout forzado.
 */
	irAIngresoLimpiandoSesion(mensaje = null) {
		return this._limpiarSesion()
			.then(() => {
			if (mensaje) {
				return this._navegar(this.urlIngreso, { mensaje });
			}
			return this._navegarSilencioso(this.urlIngreso);
		});
	},

	reiniciarIngreso() {
		return this._limpiarSesion();
	}
};
