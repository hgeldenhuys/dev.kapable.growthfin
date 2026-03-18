/**
 * Login Page
 * Pre-populated with test credentials for development
 *
 * 🔐 TEST CREDENTIALS (Pre-filled):
 * Email: test@newleads.co.za
 * Password: test123
 *
 * ⚠️ TESTING INSTRUCTIONS:
 * When testing this page, you do NOT need to fill in any fields.
 * The email and password fields are pre-populated.
 * Simply click the "Sign In" button to test the auth flow.
 */

import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Login - ACME CORP' },
    { name: 'description', content: 'Sign in to your ACME CORP account' },
  ];
};

import { auth } from '@agios/api-client';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    // Call API directly to get Set-Cookie header
    const response = await fetch(`${process.env.API_URL || 'http://localhost:3000'}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        error: error.error || 'Authentication failed'
      };
    }

    const data = await response.json();

    // Get the Set-Cookie header from API response
    const setCookie = response.headers.get('set-cookie');

    // Check for redirect parameter
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirect') || '/dashboard';

    // Forward the Set-Cookie header to the browser
    return redirect(redirectTo, {
      headers: {
        'Set-Cookie': setCookie || '',
      },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect');
  const isDeviceFlow = redirectTo?.includes('/device');

  return { isDeviceFlow };
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {loaderData?.isDeviceFlow ? 'Sign in to confirm device' : 'Sign in to ACME CORP'}
          </h2>
          {loaderData?.isDeviceFlow && (
            <div className="mt-2 text-center text-sm bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-blue-800 font-medium">
                🔐 Device Authentication
              </p>
              <p className="text-blue-600 mt-1">
                Sign in to confirm your CLI device
              </p>
            </div>
          )}
          <div className="mt-2 text-center text-sm text-gray-600 space-y-2">
            <p className="font-semibold text-blue-600">🔐 Test Credentials (Pre-filled)</p>
            <p>Email: <code className="bg-gray-100 px-2 py-1 rounded">test@newleads.co.za</code></p>
            <p>Password: <code className="bg-gray-100 px-2 py-1 rounded">test123</code></p>
            <p className="text-xs mt-3 text-yellow-700 bg-yellow-50 p-3 rounded">
              ⚠️ <strong>Testing Note:</strong> Fields are pre-populated. Just click "Sign In" to test.
            </p>
          </div>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue="test@newleads.co.za"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-blue-50"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                defaultValue="test123"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-blue-50"
                placeholder="Password"
              />
            </div>
          </div>

          {actionData?.error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {actionData.error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center text-sm">
            <p className="text-gray-600">
              Development mode - using test account
            </p>
          </div>
        </Form>
      </div>
    </div>
  );
}
