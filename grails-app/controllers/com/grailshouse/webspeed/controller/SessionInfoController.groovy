package com.grailshouse.webspeed.controller

import javax.servlet.http.HttpSession
import java.lang.reflect.Field
import java.lang.reflect.Modifier

class SessionInfoController {

	static class Report {

		static final int LEVEL_INFO = 0
		static final int LEVEL_WARNING = 1
		static final int LEVEL_ERROR = 2

		private final Object obj
		private final int level

		private Report(Object obj, int level) {
			this.obj = obj
			this.level = level
		}

		Object getObj() {
			return obj
		}

		int getLevel() {
			return level
		}

	}

	// TODO: Should not have instance variables in a controller/servlet
	private List<Report> notSerializableObjects
	private List<Object> checkedObjects

	private void addNotSerializableObject(Report report) {
		if (notSerializableObjects != null && report != null) {
			notSerializableObjects.add(report)
		}
	}

	private List<Field> getFields(Class<?> clazz) {
		List<Field> result = new ArrayList<Field>()
		while (clazz != null) {
			Field[] fields = clazz.getDeclaredFields()
			for (int i = 0; i < fields.length; i++) {
				Field field = fields[i]
				if (!Modifier.isStatic(field.getModifiers()) && !Modifier.isTransient(field.getModifiers())) {
					field.setAccessible(true)
					try {
						result.add(field)
					}
					catch (IllegalArgumentException e) {
						throw new RuntimeException(e)
					}
				}
			}
			clazz = clazz.getSuperclass()
		}
		return result
	}

	private boolean isSerializable(Object obj) {
		boolean result = true
		if (obj != null && !checkedObjects.contains(obj)) {
			checkedObjects.add(obj);
			Class<?> clazz = obj.getClass()
			if (!clazz.isPrimitive()) {
				if (clazz.isArray()) {
					if (!clazz.getComponentType().isPrimitive()) {
						Object[] arr = (Object[]) obj
						for (int i = 0; i < arr.length; i++) {
							Object entry = arr[i]
							if (!isSerializable(entry)) {
								addNotSerializableObject(new Report(entry, Report.LEVEL_ERROR))
								result = false // but do not break loop - wanna find all not serializable objects
							}
						}
					}
				}
				else if (obj instanceof Collection) { // is collection
					for (Iterator<?> iterator = ((Collection<?>) obj).iterator(); iterator.hasNext();) {
						Object entry = iterator.next()
						if (!(entry instanceof Serializable)) {
							addNotSerializableObject(new Report(entry, Report.LEVEL_ERROR))
							result = false
						}
					}
				}
				else if (obj instanceof Map) { // is map
					for (Iterator<?> iterator = ((Map<?, ?>) obj).values().iterator(); iterator.hasNext();) {
						Object entry = iterator.next()
						if (!(entry instanceof Serializable)) {
							addNotSerializableObject(new Report(entry, Report.LEVEL_ERROR))
							result = false
						}
					}
				} else {
					// we have to check whether or not the initial object implements Serializable
					if (!(obj instanceof Serializable)) {
						addNotSerializableObject(new Report(obj, Report.LEVEL_ERROR))
						result = false
					}
					List<Field> fields = getFields(clazz)
					for (Iterator<Field> i = fields.iterator(); i.hasNext();) {
						Field field = i.next()
						field.setAccessible(true)
						try {
							Object value = field.get(obj)
							if (!isSerializable(value)) {
								addNotSerializableObject(new Report(obj, Report.LEVEL_ERROR))
								result = false
							}
						}
						catch (IllegalArgumentException e) {
							throw new RuntimeException(e)
						}
						catch (IllegalAccessException e) {
							throw new RuntimeException(e)
						}
					}
				}
			}
		}
		return result
	}

	protected synchronized void detect() {
		notSerializableObjects = new ArrayList<Report>()
		checkedObjects = new ArrayList<Object>()
		HttpSession session = request.getSession(false)
		if (session != null) {
			//FileOutputStream fos = (request.getParameter('serialize') != null) ? new FileOutputStream('/serialize.txt') : null
			FileOutputStream fos = new FileOutputStream('serialize.txt')
			ObjectOutputStream oos = new ObjectOutputStream(fos)
			oos.writeChars('') // empty file (almost)
			for (Enumeration<String> e = session.getAttributeNames(); e.hasMoreElements();) {
				String attributeName = e.nextElement()
				Object attributeObj = session.getAttribute(attributeName)
				if (oos != null) {
					try {
						oos.writeObject(attributeObj)
					}
					catch (NotSerializableException ex) {
						println('not serializable: ' + ex.getMessage())
					}
				}
				isSerializable(attributeObj)
			}
			if (oos != null) {
				oos.close()
			}
			if (fos != null) {
				fos.close()
			}
		}
		response.contentType = 'text/plain; charset=utf-8'
		response.outputStream << "Found ${notSerializableObjects.size()} not-serializable objects in session"
	}

	def index() {
		detect()
	}

}
