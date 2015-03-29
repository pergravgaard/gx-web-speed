<div id="list-${domainClass.propertyName}" class="scaffold scaffold-list">

<gx:paginate total="\${${propertyName}Count}" />

<div class="list">
<gx:dataTable />
</div>

<gx:paginate total="\${${propertyName}Count}" />

</div>
