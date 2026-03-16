// Gestión de Empleados - Frontend
class EmpleadoCRUD {
    constructor() {
        this.empleados = [];
        this.roles = [];
        this.perfiles = [];
        this.menu = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.cargarDatosIniciales();
        this.renderizarTabla();
    }

    setupEventListeners() {
        // Botones principales
        document.getElementById('btnNuevoEmpleado').addEventListener('click', () => this.mostrarModalEmpleado());
        document.getElementById('btnRolesPermisos').addEventListener('click', () => this.mostrarModalRolesPermisos());
        document.getElementById('btnFiltrar').addEventListener('click', () => this.filtrarEmpleados());
        document.getElementById('btnGuardarEmpleado').addEventListener('click', () => this.guardarEmpleado());

        // Filtros
        ['filtroNombre', 'filtroDepartamento', 'filtroEstado'].forEach(id => {
            document.getElementById(id).addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.filtrarEmpleados();
            });
        });

        // Tabs de roles y permisos
        document.getElementById('btnNuevoRol').addEventListener('click', () => this.mostrarModalRol());
        document.getElementById('btnNuevoPerfil').addEventListener('click', () => this.mostrarModalPerfil());
        document.getElementById('btnNuevoMenu').addEventListener('click', () => this.mostrarModalMenu());
        
        document.getElementById('perfilPermisos').addEventListener('change', (e) => {
            if (e.target.value) this.cargarPermisosPorPerfil(e.target.value);
        });

        // Limpiar modal al cerrar
        document.getElementById('modalEmpleado').addEventListener('hidden.bs.modal', () => {
            this.limpiarFormularioEmpleado();
        });
    }

    async cargarDatosIniciales() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }

            // Cargar empleados
            const empleadosResponse = await fetch('/empleado/empleados', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.empleados = await empleadosResponse.json();

            // Cargar roles
            const rolesResponse = await fetch('/empleado/roles-empleado', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.roles = await rolesResponse.json();

            // Cargar perfiles
            const perfilesResponse = await fetch('/empleado/perfiles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.perfiles = await perfilesResponse.json();

            // Cargar menú
            const menuResponse = await fetch('/empleado/menu', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.menu = await menuResponse.json();

            // Cargar menú dinámico para el usuario
            await this.cargarMenuUsuario();

        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            this.mostrarAlerta('Error al cargar los datos iniciales', 'danger');
        }
    }

    async cargarMenuUsuario() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/empleado/menu-usuario', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const menuData = await response.json();
            this.renderizarMenuDinamico(menuData);
        } catch (error) {
            console.error('Error al cargar menú de usuario:', error);
        }
    }

    renderizarMenuDinamico(menuItems) {
        const sidebarMenu = document.getElementById('sidebarMenu');
        sidebarMenu.innerHTML = '';

        menuItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            
            const a = document.createElement('a');
            a.className = 'nav-link text-white';
            a.href = item.ruta || '#';
            a.innerHTML = `
                <i class="${item.icono || 'fas fa-circle'} me-2"></i>
                ${item.nombre_opcion}
            `;
            
            if (item.submenu && item.submenu.length > 0) {
                // Crear submenú
                const submenu = document.createElement('ul');
                submenu.className = 'nav flex-column ms-3';
                
                item.submenu.forEach(subItem => {
                    const subLi = document.createElement('li');
                    subLi.className = 'nav-item';
                    
                    const subA = document.createElement('a');
                    subA.className = 'nav-link text-white';
                    subA.href = subItem.ruta || '#';
                    subA.innerHTML = `
                        <i class="${subItem.icono || 'fas fa-circle'} me-2"></i>
                        ${subItem.nombre_opcion}
                    `;
                    
                    subLi.appendChild(subA);
                    submenu.appendChild(subLi);
                });
                
                li.appendChild(a);
                li.appendChild(submenu);
            } else {
                li.appendChild(a);
            }
            
            sidebarMenu.appendChild(li);
        });
    }

    renderizarTabla() {
        const tbody = document.getElementById('tablaEmpleadosBody');
        tbody.innerHTML = '';

        const empleadosFiltrados = this.obtenerEmpleadosFiltrados();
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = empleadosFiltrados.slice(startIndex, endIndex);

        pageData.forEach(empleado => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${empleado.codigo_empleado}</td>
                <td>${empleado.nombre}</td>
                <td>${empleado.email}</td>
                <td>${empleado.departamento || '-'}</td>
                <td>${empleado.puesto || '-'}</td>
                <td>
                    <span class="badge bg-${this.getEstadoColor(empleado.estado)}">
                        ${empleado.estado || 'activo'}
                    </span>
                </td>
                <td>${empleado.roles_empleado || '-'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info btn-sm" onclick="empleadoCRUD.editarEmpleado(${empleado.id_empleado})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-warning btn-sm" onclick="empleadoCRUD.gestionarPerfiles(${empleado.id_empleado})">
                            <i class="fas fa-user-tag"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="empleadoCRUD.eliminarEmpleado(${empleado.id_empleado})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.actualizarTotales(empleadosFiltrados.length);
        this.renderizarPaginacion(empleadosFiltrados.length);
    }

    obtenerEmpleadosFiltrados() {
        let filtrados = [...this.empleados];

        const nombre = document.getElementById('filtroNombre').value.toLowerCase();
        const departamento = document.getElementById('filtroDepartamento').value;
        const estado = document.getElementById('filtroEstado').value;

        if (nombre) {
            filtrados = filtrados.filter(e => 
                e.nombre.toLowerCase().includes(nombre) || 
                e.email.toLowerCase().includes(nombre)
            );
        }

        if (departamento) {
            filtrados = filtrados.filter(e => e.departamento === departamento);
        }

        if (estado) {
            filtrados = filtrados.filter(e => e.estado === estado);
        }

        return filtrados;
    }

    filtrarEmpleados() {
        this.currentPage = 1;
        this.renderizarTabla();
    }

    actualizarTotales(total) {
        document.getElementById('totalCount').textContent = `Total: ${total} empleados`;
    }

    renderizarPaginacion(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        // Botón anterior
        const liPrev = document.createElement('li');
        liPrev.className = `page-item ${this.currentPage === 1 ? 'disabled' : ''}`;
        liPrev.innerHTML = `<a class="page-link" href="#" onclick="empleadoCRUD.cambiarPagina(${this.currentPage - 1})">Anterior</a>`;
        pagination.appendChild(liPrev);

        // Páginas
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                const li = document.createElement('li');
                li.className = `page-item ${i === this.currentPage ? 'active' : ''}`;
                li.innerHTML = `<a class="page-link" href="#" onclick="empleadoCRUD.cambiarPagina(${i})">${i}</a>`;
                pagination.appendChild(li);
            }
        }

        // Botón siguiente
        const liNext = document.createElement('li');
        liNext.className = `page-item ${this.currentPage === totalPages ? 'disabled' : ''}`;
        liNext.innerHTML = `<a class="page-link" href="#" onclick="empleadoCRUD.cambiarPagina(${this.currentPage + 1})">Siguiente</a>`;
        pagination.appendChild(liNext);
    }

    cambiarPagina(page) {
        this.currentPage = page;
        this.renderizarTabla();
    }

    getEstadoColor(estado) {
        switch (estado) {
            case 'activo': return 'success';
            case 'inactivo': return 'secondary';
            case 'suspendido': return 'warning';
            default: return 'primary';
        }
    }

    mostrarModalEmpleado(empleadoId = null) {
        const modal = new bootstrap.Modal(document.getElementById('modalEmpleado'));
        const title = document.getElementById('modalEmpleadoTitle');
        
        if (empleadoId) {
            title.textContent = 'Editar Empleado';
            this.cargarEmpleado(empleadoId);
        } else {
            title.textContent = 'Nuevo Empleado';
            this.limpiarFormularioEmpleado();
        }
        
        this.cargarPerfilesDisponibles();
        modal.show();
    }

    async cargarEmpleado(empleadoId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/empleado/empleados/${empleadoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const empleado = await response.json();

            document.getElementById('idEmpleado').value = empleado.id_empleado;
            document.getElementById('nombreEmpleado').value = empleado.nombre;
            document.getElementById('emailEmpleado').value = empleado.email;
            document.getElementById('telefonoEmpleado').value = empleado.telefono || '';
            document.getElementById('codigoEmpleado').value = empleado.codigo_empleado;
            document.getElementById('fechaContratacion').value = empleado.fecha_contratacion;
            document.getElementById('salarioEmpleado').value = empleado.salario || '';
            document.getElementById('departamentoEmpleado').value = empleado.departamento || '';
            document.getElementById('puestoEmpleado').value = empleado.puesto || '';
            document.getElementById('estadoEmpleado').value = empleado.estado || 'activo';

        } catch (error) {
            console.error('Error al cargar empleado:', error);
            this.mostrarAlerta('Error al cargar los datos del empleado', 'danger');
        }
    }

    limpiarFormularioEmpleado() {
        document.getElementById('formEmpleado').reset();
        document.getElementById('idEmpleado').value = '';
    }

    cargarPerfilesDisponibles() {
        const container = document.getElementById('perfilesContainer');
        container.innerHTML = '';

        this.perfiles.forEach(perfil => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${perfil.id_perfil}" id="perfil_${perfil.id_perfil}">
                <label class="form-check-label" for="perfil_${perfil.id_perfil}">
                    ${perfil.nombre_perfil} (${perfil.nombre_rol})
                </label>
            `;
            container.appendChild(div);
        });
    }

    async guardarEmpleado() {
        try {
            const token = localStorage.getItem('token');
            const idEmpleado = document.getElementById('idEmpleado').value;
            const empleadoData = {
                nombre: document.getElementById('nombreEmpleado').value,
                email: document.getElementById('emailEmpleado').value,
                telefono: document.getElementById('telefonoEmpleado').value,
                password: document.getElementById('passwordEmpleado').value,
                codigo_empleado: document.getElementById('codigoEmpleado').value,
                fecha_contratacion: document.getElementById('fechaContratacion').value,
                salario: parseFloat(document.getElementById('salarioEmpleado').value) || null,
                departamento: document.getElementById('departamentoEmpleado').value,
                puesto: document.getElementById('puestoEmpleado').value,
                estado: document.getElementById('estadoEmpleado').value,
                perfiles: this.getPerfilesSeleccionados()
            };

            const url = idEmpleado ? `/empleado/empleados/${idEmpleado}` : '/empleado/empleados';
            const method = idEmpleado ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(empleadoData)
            });

            if (response.ok) {
                this.mostrarAlerta(idEmpleado ? 'Empleado actualizado correctamente' : 'Empleado creado correctamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('modalEmpleado')).hide();
                await this.cargarDatosIniciales();
                this.renderizarTabla();
            } else {
                const error = await response.json();
                this.mostrarAlerta(error.error || 'Error al guardar empleado', 'danger');
            }

        } catch (error) {
            console.error('Error al guardar empleado:', error);
            this.mostrarAlerta('Error al guardar empleado', 'danger');
        }
    }

    getPerfilesSeleccionados() {
        const checkboxes = document.querySelectorAll('#perfilesContainer input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    async editarEmpleado(empleadoId) {
        this.mostrarModalEmpleado(empleadoId);
    }

    async eliminarEmpleado(empleadoId) {
        if (!confirm('¿Está seguro de eliminar este empleado? Esta acción también eliminará el usuario asociado.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/empleado/empleados/${empleadoId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.mostrarAlerta('Empleado eliminado correctamente', 'success');
                await this.cargarDatosIniciales();
                this.renderizarTabla();
            } else {
                const error = await response.json();
                this.mostrarAlerta(error.error || 'Error al eliminar empleado', 'danger');
            }

        } catch (error) {
            console.error('Error al eliminar empleado:', error);
            this.mostrarAlerta('Error al eliminar empleado', 'danger');
        }
    }

    async gestionarPerfiles(empleadoId) {
        // Implementar gestión de perfiles por empleado
        this.mostrarAlerta('Funcionalidad en desarrollo', 'info');
    }

    mostrarModalRolesPermisos() {
        const modal = new bootstrap.Modal(document.getElementById('modalRolesPermisos'));
        this.cargarDatosRolesPermisos();
        modal.show();
    }

    async cargarDatosRolesPermisos() {
        await this.cargarRoles();
        await this.cargarPerfiles();
        await this.cargarMenu();
        await this.cargarPerfilesParaPermisos();
    }

    async cargarRoles() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/empleado/roles-empleado', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.roles = await response.json();
            this.renderizarRoles();
        } catch (error) {
            console.error('Error al cargar roles:', error);
        }
    }

    renderizarRoles() {
        const tbody = document.getElementById('tablaRolesBody');
        tbody.innerHTML = '';

        this.roles.forEach(rol => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rol.nombre}</td>
                <td>${rol.descripcion || '-'}</td>
                <td>${rol.nivel_jerarquico}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info btn-sm" onclick="empleadoCRUD.editarRol(${rol.id_rol_empleado})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="empleadoCRUD.eliminarRol(${rol.id_rol_empleado})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async cargarPerfiles() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/empleado/perfiles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.perfiles = await response.json();
            this.renderizarPerfiles();
        } catch (error) {
            console.error('Error al cargar perfiles:', error);
        }
    }

    renderizarPerfiles() {
        const tbody = document.getElementById('tablaPerfilesBody');
        tbody.innerHTML = '';

        this.perfiles.forEach(perfil => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${perfil.nombre_perfil}</td>
                <td>${perfil.nombre_rol}</td>
                <td>${perfil.descripcion || '-'}</td>
                <td>
                    <span class="badge bg-${perfil.activo ? 'success' : 'secondary'}">
                        ${perfil.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info btn-sm" onclick="empleadoCRUD.editarPerfil(${perfil.id_perfil})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="empleadoCRUD.eliminarPerfil(${perfil.id_perfil})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async cargarMenu() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/empleado/menu', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            this.menu = await response.json();
            this.renderizarMenu();
        } catch (error) {
            console.error('Error al cargar menú:', error);
        }
    }

    renderizarMenu() {
        const tbody = document.getElementById('tablaMenuBody');
        tbody.innerHTML = '';

        this.menu.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nombre_opcion}</td>
                <td><i class="${item.icono || ''}"></i> ${item.icono || '-'}</td>
                <td>${item.ruta || '-'}</td>
                <td>${item.nombre_padre || '-'}</td>
                <td>${item.orden_visualizacion}</td>
                <td>
                    <span class="badge bg-${item.activo ? 'success' : 'secondary'}">
                        ${item.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info btn-sm" onclick="empleadoCRUD.editarMenu(${item.id_menu})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="empleadoCRUD.eliminarMenu(${item.id_menu})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async cargarPerfilesParaPermisos() {
        const select = document.getElementById('perfilPermisos');
        select.innerHTML = '<option value="">Seleccionar perfil...</option>';

        this.perfiles.forEach(perfil => {
            const option = document.createElement('option');
            option.value = perfil.id_perfil;
            option.textContent = `${perfil.nombre_perfil} (${perfil.nombre_rol})`;
            select.appendChild(option);
        });
    }

    async cargarPermisosPorPerfil(perfilId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/empleado/permisos/perfil/${perfilId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const permisos = await response.json();
            this.renderizarPermisos(permisos);
        } catch (error) {
            console.error('Error al cargar permisos:', error);
        }
    }

    renderizarPermisos(permisos) {
        const container = document.getElementById('permisosContainer');
        container.innerHTML = '';

        if (permisos.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay permisos configurados para este perfil.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'table table-dark table-sm';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Opción de Menú</th>
                    <th>Ver</th>
                    <th>Crear</th>
                    <th>Editar</th>
                    <th>Eliminar</th>
                    <th>Exportar</th>
                </tr>
            </thead>
            <tbody>
                ${permisos.map(permiso => `
                    <tr>
                        <td>${permiso.nombre_opcion}</td>
                        <td><input type="checkbox" ${permiso.puede_ver ? 'checked' : ''} disabled></td>
                        <td><input type="checkbox" ${permiso.puede_crear ? 'checked' : ''} disabled></td>
                        <td><input type="checkbox" ${permiso.puede_editar ? 'checked' : ''} disabled></td>
                        <td><input type="checkbox" ${permiso.puede_eliminar ? 'checked' : ''} disabled></td>
                        <td><input type="checkbox" ${permiso.puede_exportar ? 'checked' : ''} disabled></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }

    // Métodos placeholder para funcionalidades futuras
    mostrarModalRol() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    mostrarModalPerfil() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    mostrarModalMenu() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    editarRol() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    eliminarRol() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    editarPerfil() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    eliminarPerfil() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    editarMenu() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }
    eliminarMenu() { this.mostrarAlerta('Funcionalidad en desarrollo', 'info'); }

    mostrarAlerta(mensaje, tipo) {
        // Crear alerta flotante
        const alerta = document.createElement('div');
        alerta.className = `alert alert-${tipo} alert-dismissible fade show position-fixed`;
        alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alerta.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alerta);

        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            if (alerta.parentNode) {
                alerta.parentNode.removeChild(alerta);
            }
        }, 5000);
    }
}

// Inicializar cuando el DOM esté listo
let empleadoCRUD;
document.addEventListener('DOMContentLoaded', () => {
    empleadoCRUD = new EmpleadoCRUD();
});
