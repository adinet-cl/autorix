import { DynamicModule, Module, Provider } from "@nestjs/common";
import { AUTORIX_OPTIONS, AUTORIX_POLICY_PROVIDER } from "./autorix.constants";
import type { AutorixNestjsOptions } from "./autorix.interfaces";
import type { PolicyProvider } from "@autorix/storage";

@Module({})
export class AutorixModule {
  static forRoot(params: { policyProvider: PolicyProvider; options?: AutorixNestjsOptions }): DynamicModule {
    const providers: Provider[] = [
      { provide: AUTORIX_POLICY_PROVIDER, useValue: params.policyProvider },
      { provide: AUTORIX_OPTIONS, useValue: params.options ?? {} },
    ];

    return {
      module: AutorixModule,
      providers,
      exports: providers,
    };
  }
}
