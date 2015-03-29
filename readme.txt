TODO:
3. AbstractDomainService: find/findAll by using withCriteria? Adjust call from AbstractPublishableController and MenuItemController in WebCMS as well
4. New comparator for sorting fields in views (should be possible to control fields in parent class from subclass constraints)
5. Should be possible to have different order of fields in list and create/edit view. Fx it make sense to have optional field come before readonly fields in forms, but in list you want the field for the first column to have data (not optional). See GraphicImage.

TODO (old):

1. When generating view from scaffolding templates in a plugin the variable cp is null. This variable refers to a constrained property. Try to set it.
2. The scaffolding list template should read the max characters in a cell from configuration object.
3. Include CSS for file uploads via JavaScript in scaffolding templates
4. The scaffolding template _form.gsp is always created when running generate-views!?
5. Detect if view is located in a plugin and render templates within the same plugin (set the plugin attribute on the render tag)