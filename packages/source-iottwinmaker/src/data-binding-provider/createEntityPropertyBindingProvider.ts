import { TwinMakerErrorCode } from '../common/error';
import { ITwinMakerEntityDataBindingContext, IValueDataBinding, IValueDataBindingProvider } from './types';
import { EntityPropertyBindingProviderStore } from './EntityPropertyBindingProviderStore';
import { ErrorDetails, TimeSeriesDataQuery } from '@iot-app-kit/core';
import { TwinMakerQuery } from '../time-series-data/types';
import { TwinMakerMetadataModule } from '../metadata-module/TwinMakerMetadataModule';

export const createEntityPropertyBindingProvider = ({
  metadataModule,
  timeSeriesDataQuery,
  onError,
}: {
  metadataModule: TwinMakerMetadataModule;
  timeSeriesDataQuery: (query: TwinMakerQuery) => TimeSeriesDataQuery;
  onError?: (errorCode: TwinMakerErrorCode, errorDetails?: ErrorDetails) => void;
}): IValueDataBindingProvider => {
  return {
    createStore: (isDataBindingTemplateProvider: boolean) =>
      new EntityPropertyBindingProviderStore({
        isDataBindingTemplateProvider,
        metadataModule,
        onError,
      }),
    // TODO: add non time series data support
    createQuery: (dataBinding: IValueDataBinding) => {
      const context = dataBinding.dataBindingContext as ITwinMakerEntityDataBindingContext;
      if (!context || !context.entityId || !context.componentName || !context.propertyName) {
        return undefined;
      }

      if (dataBinding.isStaticData) {
        // TODO: return property value query
        return undefined;
      }

      return timeSeriesDataQuery({
        entityId: context.entityId,
        componentName: context.componentName,
        properties: [{ propertyName: context.propertyName }],
      });
    },
  };
};
