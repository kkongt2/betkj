"""Export numerical trees for identical browser inference."""
def export(model,link):
    trees=[]
    for iteration in model._predictors:
        nodes=[]
        for n in iteration[0].nodes:
            if n['is_categorical']:raise ValueError('Categorical node unsupported')
            nodes.append([int(n['is_leaf']),int(n['feature_idx']),float(n['num_threshold']),int(n['left']),int(n['right']),float(n['value'])])
        trees.append(nodes)
    return dict(bias=float(model._baseline_prediction[0,0]),trees=trees,link=link,width=52)
