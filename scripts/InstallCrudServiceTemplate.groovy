import org.codehaus.groovy.grails.plugins.GrailsPluginUtils

target(main: "Installing CRUD Service Template!") {
	copyCrudServiceTemplate()
	println 'Done...'
}

setDefaultTarget(main)

private String getPluginDir() {
	return GrailsPluginUtils.pluginInfos.find { it.name == 'gx-web-speed' }.pluginDir.path
}

private void copyCrudServiceTemplate() {
	def pluginDir = getPluginDir()
	def toDir = "${basedir}/src/templates/artifacts"
	def fromDir = "${pluginDir}/src/templates/artifacts"
	ant.mkdir(dir: toDir)
	ant.copy(todir: toDir, overwrite: true) {
		fileset(dir: fromDir) {
			include name: 'Service.groovy'
		}
	}
}

