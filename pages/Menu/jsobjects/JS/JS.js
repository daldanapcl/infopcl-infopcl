export default {
	onLoad() {
		
		showAlert(
						"sesion_id: " + appsmith.store.sesion_id +
						" | autenticado: " + appsmith.store.usuario_autenticado
				)

		infoPCLAuth.protegerPagina("MENU");
	}
}