import React, { useState } from 'react';
import { ModelOption } from '../../../types';
import { ModelSelectorHeader } from './model-selector/ModelSelectorHeader';
import { ModelListEditor } from './model-selector/ModelListEditor';
import { ModelListView } from './model-selector/ModelListView';

interface ModelSelectorProps {
  availableModels: ModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  t: (key: string) => string;
  setAvailableModels: (models: ModelOption[]) => void;
  onRefreshModels: () => Promise<void>;
  isRefreshingModels: boolean;
  modelRefreshError: string | null;
}



export const ModelSelector: React.FC<ModelSelectorProps> = ({

  availableModels,

  selectedModelId,

  onSelectModel,

  setAvailableModels, onRefreshModels, isRefreshingModels, modelRefreshError,

  t

}) => {

  const [isEditingList, setIsEditingList] = useState(false);



  return (

    <div className="space-y-4">

      <ModelSelectorHeader

        isEditingList={isEditingList}

        setIsEditingList={setIsEditingList}

        t={t}

      />



      {isEditingList ? (

        <ModelListEditor

          availableModels={availableModels}

          onSave={setAvailableModels}

          setIsEditingList={setIsEditingList}

          t={t}
          onRefreshModels={onRefreshModels}
          isRefreshingModels={isRefreshingModels}
          modelRefreshError={modelRefreshError}

        />

      ) : (

        <ModelListView

          availableModels={availableModels}

          selectedModelId={selectedModelId}

          onSelectModel={onSelectModel}

          t={t}

        />

      )}

    </div>

  );

};
