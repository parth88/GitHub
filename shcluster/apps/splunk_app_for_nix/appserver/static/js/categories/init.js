(function($, _){
    

$(document).ready(function(){
    var catPanel,
        groupPanel,
        hostPanel,
        $hostPanel,
        $catPanel,
        $groupPanel,
        catModel,
        groupModel,
        hostModel,
        categoryModel,
        panels;

    $catPanel = $('#catPanel');
    $groupPanel = $('#groupPanel');
    $hostPanel = $('#hostPanel')

    function setup(){
        catModel = new CategoryChildModel(categoryModel);
        groupModel = new CategoryChildModel(categoryModel);
        hostModel = new CategoryChildModel(categoryModel);

        catPanel = new LinkedBasicPanel($catPanel, 'Category', catModel);
        groupPanel = new LinkedBasicPanel($groupPanel, 'Group', groupModel);
        hostPanel = new LinkedHostsPanel($hostPanel, 'Host', hostModel);

        catPanel.setPrevPanel(null);
        catPanel.setNextPanel(groupPanel);
        groupPanel.setPrevPanel(catPanel);
        groupPanel.setNextPanel(hostPanel);
        hostPanel.setPrevPanel(groupPanel);
        hostPanel.setNextPanel(null);

        catPanel.open();
    }

    function onError(err){
        console.error('Error initializing categories: ', err);
    }

    categoryModel = new CategoryRootModel();
    categoryModel.load(setup, onError);

});


})(UnixjQuery, UnixUnderscore);

