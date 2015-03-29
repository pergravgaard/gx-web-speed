//import grails.util.GrailsNameUtils
//import grails.util.Metadata
//import groovy.text.SimpleTemplateEngine
import org.codehaus.groovy.grails.plugins.GrailsPluginUtils
//includeTargets << grailsScript("_GrailsInit")

target(main: "Installing Scaffolding Controller Template!") {
	copyScaffoldingControllerTemplate()
	println 'Done...'
}

setDefaultTarget(main)

private String getPluginDir() {
	return GrailsPluginUtils.pluginInfos.find { it.name == 'gx-web-speed' }.pluginDir.path
}

private void copyScaffoldingControllerTemplate() {
	def pluginDir = getPluginDir()
	def toDir = "${basedir}/src/templates/scaffolding"
	def fromDir = "${pluginDir}/src/templates/scaffolding"
	ant.mkdir(dir: toDir)
	ant.copy(todir: toDir, overwrite: true) {
		fileset(dir: fromDir) {
			include name: 'Controller.groovy'
		}
	}
}

