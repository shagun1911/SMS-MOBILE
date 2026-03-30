import { forwardRef } from "react";
import {
  ScrollView,
  RefreshControl,
  ScrollViewProps,
  Platform,
} from "react-native";
import { useGlobalRefreshOptional } from "@/contexts/GlobalRefreshContext";

export type RefreshableScrollViewProps = ScrollViewProps & {
  /** Skip pull-to-refresh (e.g. nested scroll areas). */
  disablePullRefresh?: boolean;
};

/**
 * Same as ScrollView, with pull-to-refresh that runs registered screen reload handlers.
 */
export const RefreshableScrollView = forwardRef<ScrollView, RefreshableScrollViewProps>(
  function RefreshableScrollView(
    { disablePullRefresh, refreshControl, ...rest },
    ref
  ) {
    const ctx = useGlobalRefreshOptional();

    const mergedControl =
      disablePullRefresh || !ctx
        ? refreshControl
        : (
            <RefreshControl
              refreshing={ctx.isRefreshing}
              onRefresh={() => {
                void ctx.onPullRefresh();
              }}
              colors={["#059669"]}
              tintColor="#059669"
              progressViewOffset={Platform.OS === "android" ? 0 : undefined}
            />
          );

    return <ScrollView ref={ref} {...rest} refreshControl={mergedControl ?? refreshControl} />;
  }
);
