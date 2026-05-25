export default {
	verificarAutenticacion () {
		AutenticarUsuario.run()
			.then(() => infoPCLAuth.procesarLogin(AutenticarUsuario.data, "MENU"));
		
		/*if (AutenticarUsuario.data[0].resultado === 'OK') {
			storeValue('sesion_id',      			AutenticarUsuario.data[0].sesion_id);
			storeValue('usuario_id',       		AutenticarUsuario.data[0].usuario_id);
			storeValue('nombre_usuario',   		AutenticarUsuario.data[0].nombre_usuario);
			storeValue('correo_electronico',	AutenticarUsuario.data[0].correo_electronico);
			navigateTo('Menu');
		} else {
			showAlert(AutenticarUsuario.data[0].resultado, 'error');
		}*/
	}
}