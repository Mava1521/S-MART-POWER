import { db } from "../config/firebaseAdmin.js";
import cloudinary from "../config/cloudinary.js";
import { logAudit } from "../services/auditService.js";

const devicesCollection = db.collection("devices");

/** Quita powerConsumption de la respuesta si quien pregunta no es admin (dato oculto real, no solo en el UI). */
function serializeDevice(doc, role) {
  const data = doc.data();
  const base = {
    id: doc.id,
    categoryId: data.categoryId || null,
    categoryName: data.categoryName || null,
    product: data.product || data.item || "", // "item" es el nombre viejo del campo, por compatibilidad con ítems ya creados
    reference: data.reference ?? data.description ?? "",
    photoUrl: data.photoUrl || null,
    createdAt: data.createdAt,
  };
  if (role === "admin") base.powerConsumption = data.powerConsumption ?? null;
  return base;
}

/** Lista/busca la biblioteca. Todos los roles autenticados pueden ver (sin poder editar salvo admin/subadmin/productor). */
export async function listDevices(req, res, next) {
  try {
    const { search, categoryId } = req.query;
    const snapshot = await devicesCollection.orderBy("createdAt", "desc").get();
    let devices = snapshot.docs.map((d) => serializeDevice(d, req.user.role));

    if (categoryId) devices = devices.filter((d) => d.categoryId === categoryId);
    if (search) {
      const s = search.toLowerCase();
      devices = devices.filter(
        (d) => d.product?.toLowerCase().includes(s) || d.reference?.toLowerCase().includes(s) || d.categoryName?.toLowerCase().includes(s)
      );
    }

    res.json(devices);
  } catch (err) {
    next(err);
  }
}

/**
 * Crea un ítem de biblioteca: categoría (de la lista existente), producto, referencia, foto y
 * consumo eléctrico (kW). El consumo solo lo puede capturar/ver un admin; si lo crea alguien
 * más, ese campo simplemente queda vacío hasta que un admin lo complete.
 * Solo admin, sub-admin y productor pueden crear ítems — un usuario final ya no puede agregar
 * directamente a la biblioteca (ver deviceRequestController.js: en su lugar, puede enviar un
 * link con lo que necesita para que un sub-admin/admin lo agregue).
 */
export async function createDevice(req, res, next) {
  try {
    const { categoryId, product, reference, powerConsumption } = req.body;
    if (!product?.trim()) {
      return res.status(400).json({ error: "El nombre del producto es obligatorio" });
    }

    let categoryName = null;
    if (categoryId) {
      const categorySnap = await db.collection("deviceCategories").doc(categoryId).get();
      if (!categorySnap.exists) return res.status(400).json({ error: "La categoría elegida no existe" });
      categoryName = categorySnap.data().name;
    }

    let photoUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "eventos-devices" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      photoUrl = uploadResult.secure_url;
    }

    const ref = await devicesCollection.add({
      categoryId: categoryId || null,
      categoryName,
      product: product.trim(),
      reference: reference?.trim() || "",
      photoUrl,
      powerConsumption: req.user.role === "admin" && powerConsumption !== undefined && powerConsumption !== ""
        ? Number(powerConsumption)
        : null,
      createdBy: req.user.uid,
      createdByRole: req.user.role,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id });

    logAudit({
      eventId: null, entityType: "device", entityId: ref.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Agregó "${product.trim()}" a la biblioteca`,
    });
  } catch (err) {
    next(err);
  }
}

/** Editar: admin, sub-admin y productor. Solo admin puede capturar/editar el consumo eléctrico. */
export async function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    const { categoryId, product, reference, powerConsumption } = req.body;

    const updates = {
      ...(product !== undefined && { product: product.trim() }),
      ...(reference !== undefined && { reference: reference.trim() }),
      updatedAt: new Date().toISOString(),
    };

    if (categoryId !== undefined) {
      if (categoryId) {
        const categorySnap = await db.collection("deviceCategories").doc(categoryId).get();
        if (!categorySnap.exists) return res.status(400).json({ error: "La categoría elegida no existe" });
        updates.categoryId = categoryId;
        updates.categoryName = categorySnap.data().name;
      } else {
        updates.categoryId = null;
        updates.categoryName = null;
      }
    }

    if (req.user.role === "admin" && powerConsumption !== undefined) {
      updates.powerConsumption = powerConsumption === "" ? null : Number(powerConsumption);
    }

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "eventos-devices" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      updates.photoUrl = uploadResult.secure_url;
    }

    await devicesCollection.doc(id).update(updates);
    res.json({ message: "Ítem actualizado" });

    logAudit({
      eventId: null, entityType: "device", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Editó el ítem "${product || id}" de la biblioteca`,
    });
  } catch (err) {
    next(err);
  }
}

/** Eliminar: SOLO admin. */
export async function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;
    const snap = await devicesCollection.doc(id).get();
    await devicesCollection.doc(id).delete();
    res.json({ message: "Ítem eliminado" });

    logAudit({
      eventId: null, entityType: "device", entityId: id, action: "delete",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Eliminó "${snap.data()?.item || id}" de la biblioteca`,
    });
  } catch (err) {
    next(err);
  }
}
