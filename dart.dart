import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'principal_admin.dart';

class EditarProducto extends StatefulWidget {
  final String productoId;

  const EditarProducto({super.key, required this.productoId});

  @override
  State<EditarProducto> createState() => _EditarProductoState();
}

class _EditarProductoState extends State<EditarProducto> {
  final _formKey = GlobalKey<FormState>();
  TextEditingController nombreController = TextEditingController();
  TextEditingController precioController = TextEditingController();
  TextEditingController descripcionController = TextEditingController();
  String categoriaSeleccionada = 'Camisas';
  List<String> tallasSeleccionadas = [];

  final List<String> categorias = ['Camisas', 'Pantalones'];
  final List<String> tallas = ['S', 'M', 'L', 'XL'];

  @override
  void initState() {
    super.initState();
    cargarDatosProducto();
  }

  void cargarDatosProducto() async {
    DocumentSnapshot doc = await FirebaseFirestore.instance
        .collection('productos')
        .doc(widget.productoId)
        .get();

    Map<String, dynamic> producto =
        doc.data() as Map<String, dynamic>;

    setState(() {
      nombreController.text = producto['nombre'] ?? '';
      precioController.text = producto['precio'].toString();
      descripcionController.text = producto['descripcion'] ?? '';
      categoriaSeleccionada = producto['categoria'] ?? 'Camisas';
      tallasSeleccionadas =
          List<String>.from(producto['tallas'] ?? []);
    });
  }

  void guardarProducto() async {
    await FirebaseFirestore.instance
        .collection('productos')
        .doc(widget.productoId)
        .update({
      'nombre': nombreController.text,
      'precio': double.tryParse(precioController.text) ?? 0,
      'descripcion': descripcionController.text,
      'categoria': categoriaSeleccionada,
      'tallas': tallasSeleccionadas,
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Producto actualizado')),
    );

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const PrincipalAdmin()),
    );
  }

  Widget buildCheckboxTalla(String talla) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Checkbox(
          value: tallasSeleccionadas.contains(talla),
          onChanged: (bool? value) {
            setState(() {
              if (value == true) {
                tallasSeleccionadas.add(talla);
              } else {
                tallasSeleccionadas.remove(talla);
              }
            });
          },
        ),
        Text(talla),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('EDITAR PRODUCTO'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const Principal_admin()),
            );
          },
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Center(
                child: Column(
                  children: [
                    Icon(Icons.image, size: 100),
                    SizedBox(height: 4),
                    Text("CAMBIAR"),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text("NOMBRE"),
              TextFormField(
                controller: nombreController,
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              const Text("CATEGORÍA"),
              DropdownButtonFormField<String>(
                value: categoriaSeleccionada,
                items: categorias.map((categoria) {
                  return DropdownMenuItem(
                    value: categoria,
                    child: Text(categoria),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    categoriaSeleccionada = value!;
                  });
                },
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              const Text("PRECIO"),
              TextFormField(
                controller: precioController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              const Text("TALLAS"),
              Wrap(
                spacing: 10,
                children: tallas.map((talla) => buildCheckboxTalla(talla)).toList(),
              ),
              const SizedBox(height: 10),
              const Text("DESCRIPCIÓN"),
              TextFormField(
                controller: descripcionController,
                maxLines: 3,
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: 20),
              Center(
                child: ElevatedButton(
                  onPressed: guardarProducto,
                  child: const Text("GUARDAR"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
