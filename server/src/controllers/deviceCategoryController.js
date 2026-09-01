import { db } from "../config/firebaseAdmin.js";
import { logAudit } from "../services/auditService.js";

const categoriesCollection = db.collection("deviceCategories");

/** Cualquier rol autenticado puede ver la lista, para poder elegir una al crear/editar un ítem. */
export async function listCategories(req, res, next) {
  try {
    const snapshot = await categoriesCollection.orderBy("name", "asc").get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name })));
  } catch (err) {
    next(err);
  }
}

/**
 * Crea una categoría nueva (ej. "Sonido", "Iluminación", "Refrigeración"). Solo admin y
 * sub-admin, para mantener el listado controlado y evitar que la misma categoría termine
 * escrita de formas distintas ("Sonido" / "sonido" / "Audio") por descuido de otros roles.
 * Si ya existe una con el mismo nombre (sin importar mayúsculas/acentos de más), la reutiliza
 * en vez de crear un duplicado.
 */
export async function createCategory(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "El nombre de la categoría es obligatorio" });

    const clean = name.trim();
    const normalized = clean.toLowerCase();
    const existingSnap = await categoriesCollection.get();
    const dup = existingSnap.docs.find((d) => d.data().name.trim().toLowerCase() === normalized);
    if (dup) return res.json({ id: dup.id, name: dup.data().name });

    const ref = await categoriesCollection.add({
      name: clean,
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id, name: clean });

    logAudit({
      eventId: null, entityType: "deviceCategory", entityId: ref.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Creó la categoría "${clean}"`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Renombra una categoría existente. Solo admin y sub-admin. Si el nuevo nombre ya lo usa
 * otra categoría, avisa en vez de dejar dos categorías con el mismo nombre.
 */
export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "El nombre de la categoría es obligatorio" });

    const clean = name.trim();
    const normalized = clean.toLowerCase();
    const existingSnap = await categoriesCollection.get();
    const dup = existingSnap.docs.find((d) => d.id !== id && d.data().name.trim().toLowerCase() === normalized);
    if (dup) return res.status(409).json({ error: `Ya existe una categoría llamada "${dup.data().name}"` });

    const ref = categoriesCollection.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Categoría no encontrada" });

    await ref.update({ name: clean });

    // Actualiza el nombre "congelado" (categoryName) en los ítems que ya la usan, para que
    // no queden mostrando el nombre viejo en la biblioteca.
    const devicesSnap = await db.collection("devices").where("categoryId", "==", id).get();
    if (!devicesSnap.empty) {
      const batch = db.batch();
      devicesSnap.docs.forEach((d) => batch.update(d.ref, { categoryName: clean }));
      await batch.commit();
    }

    res.json({ id, name: clean });

    logAudit({
      eventId: null, entityType: "deviceCategory", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Renombró la categoría a "${clean}"`,
    });
  } catch (err) {
    next(err);
  }
}

/** Eliminar una categoría: solo admin, y solo si ningún ítem de la biblioteca la está usando. */
export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const inUseSnap = await db.collection("devices").where("categoryId", "==", id).limit(1).get();
    if (!inUseSnap.empty) {
      return res.status(409).json({ error: "No se puede eliminar: hay ítems de la biblioteca usando esta categoría" });
    }
    await categoriesCollection.doc(id).delete();
    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    next(err);
  }
}
