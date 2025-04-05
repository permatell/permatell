declare module '@permaweb/aoprofile' {
  interface AOProfileSDK {
    createProfile: (profileData: any) => Promise<string>;
    updateProfile: (data: { profileId: string; [key: string]: any }) => Promise<string>;
    getProfileById: (data: { profileId: string }) => Promise<any>;
    getProfileByWalletAddress: (data: { address: string }) => Promise<any>;
    getRegistryProfiles: () => Promise<any[]>;
  }

  interface AOProfileInitOptions {
    ao: any;
    signer: any;
    arweave: any;
  }

  export default {
    init: (options: AOProfileInitOptions): AOProfileSDK => {
      return {
        createProfile: async () => '',
        updateProfile: async () => '',
        getProfileById: async () => null,
        getProfileByWalletAddress: async () => null,
        getRegistryProfiles: async () => [],
      };
    },
  };
} 